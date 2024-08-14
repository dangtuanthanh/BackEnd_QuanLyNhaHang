const db = require('../dbconfig');
const pool = db.getPool();
const sql = require('mssql');
const { format } = require('date-fns'); //ép định dạng cho ngày tháng năm
const bcrypt = require('bcrypt'); // dùng để mã hoá mật khẩu và tạo mã phiên đăng nhập
const nodemailer = require('nodemailer');//dùng để gửi email
//Kiểm tra phiên và quyền đăng nhập
async function checkSessionAndRole(ss, permission) {
  try {
    const NgayHomNay = new Date();
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .input('NgayHomNay', sql.DateTime, NgayHomNay)
      .execute('loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap');

    // .query(`SELECT IDNhanVien, HanDangNhap FROM NhanVien WHERE MaDangNhap = @MaDangNhap AND NhanVien.DaXoa = 0`);
    if (result.recordset.length === 0) {
      console.log("Không tìm thấy người dùng với mã đăng nhập:", ss);
      return false;
    } else {
      const timeSession = result.recordset[0].HanDangNhap;
      const currentTime = new Date();
      if (currentTime > timeSession) {
        console.log("Thời gian đăng nhập đã hết hạn:", ss);
        return false;
      } else {
        //Kiểm tra vai trò
        let resultVaiTro = await pool
          .request()
          .input('IDNhanVien', sql.Int, result.recordset[0].IDNhanVien)
          .query('EXEC loginAndPermission_checkSessionAndRole_getPermissionByIDNhanVien @IDNhanVien');
        const permissions = resultVaiTro.recordset.map((row) => row.TenQuyen);
        for (const p of permissions) {
          if (p === permission) {
            return true; // Nếu tìm thấy quyền khớp với biến permission, trả về true
          }
        }
        return false; // Nếu không tìm thấy quyền nào khớp với biến permission, trả về false
      }
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra phiên và vai trò:", error);
    throw error;
  }
}
//lấy mã IDDoiTac
async function getIDDoiTac(ss) {
  try {
    let result = await pool.request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getIDDoiTac @MaDangNhap');
    return result.recordset[0].IDDoiTac;
  } catch (error) {
    console.error("Lỗi khi lấy IDDoiTac", error);
    throw error;
  }
}
// Hàm đăng ký
async function register(data) {
  try {
    // kiểm tra email đã được  đăng ký chưa
    const resultCheckEmail = await pool.request()
      .input("Email", sql.NVarChar, data.Email)
      .execute("loginAndPermission_register_checkEmail");
    const CheckEmail = resultCheckEmail.recordset[0][''];
    if (CheckEmail) {
      return {
        success: false,
        message: 'Email đã được sử dụng'
      };
    }
    // cấu hình email
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'dangtuanthanh265@gmail.com',
        pass: 'jjgkyyjscrysbxsy' // Sử dụng biến môi trường EMAIL_PASSWORD
      }
    });
    const randomCode = generateRandomCode()
    console.log('randomCode', randomCode);
    let mailOptions = {
      from: 'dangtuanthanh265@gmail.com',
      to: `${data.Email}`,
      subject: 'Mã xác thực VRes',
      text: `Chào bạn. Đây là mã xác thực kích hoạt tài khoản của bạn: ${randomCode}`
    };
    await transporter.sendMail(mailOptions, async function (error, info) {
      if (error) {
        throw error;
      } else {
        //sau khi gửi email, lưu mã vào csdl
        await pool.request()
          .input("TenDoanhNghiep", sql.NVarChar, data.TenDoanhNghiep)
          .input("Email", sql.NVarChar, data.Email)
          .input("MatKhau", sql.NVarChar, data.MatKhau)
          .input("MaXacThuc", sql.VarChar, randomCode)
          .input("NgaySinh", sql.Date, data.NgaySinh)
          .input("DiaChi", sql.NVarChar, data.DiaChi)
          .input("SoDienThoai", sql.NVarChar, data.SoDienThoai)
          .input("SuDungDuLieuMau", sql.Bit, data.SuDungDuLieuMau)
          .execute("loginAndPermission_register_saveEmailAndCode");

      }
    });
    return {
      success: true
    };
  } catch (error) {
    console.log("Lỗi khi đăng ký: " + error);
    throw error;

  }
}
// tạo ngẫu nhiên chữ số:
function generateRandomCode() {
  let code = '';
  const possible = '0123456789';
  for (let i = 0; i < 4; i++) {
    code += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return code;
}
//xác thực mã
async function registerCode(Code) {
  try {
    const result = await pool.request()
      .input('Code', sql.VarChar, Code)
      .query('EXEC loginAndPermission_register_verificationCode @Code');
    if (result.recordset.length === 0) {
      return {
        success: false,
        message: 'Mã Xác Thực Không Chính Xác'
      };
    } else {
      const TenDoanhNghiep = result.recordset[0]['TenDoanhNghiep']
      const Email = result.recordset[0]['Email']
      const NgaySinh = result.recordset[0]['NgaySinh']
      console.log("result.recordset[0]['MatKhau']", result.recordset[0]['MatKhau']);
      const MatKhau = await bcrypt.hash(result.recordset[0]['MatKhau'], 10)
      const DiaChi = result.recordset[0]['DiaChi']
      const SoDienThoai = result.recordset[0]['SoDienThoai']
      const SuDungDuLieuMau = result.recordset[0]['SuDungDuLieuMau']
      //thêm đối tác
      const NgayDangKy = new Date();
      const NgayHetHan = new Date(NgayDangKy.getTime() + (7 * 24 * 60 * 60 * 1000));
      const resultInsertPartner = await pool.request()
        .input('TenDoanhNghiep', sql.NVarChar, TenDoanhNghiep)
        .input('Email', sql.NVarChar, Email)
        .input('DiaChi', sql.NVarChar, DiaChi)
        .input('SoDienThoai', sql.NVarChar, SoDienThoai)
        .input('NgayDangKy', sql.DateTime, NgayDangKy)
        .input('NgayHetHan', sql.DateTime, NgayHetHan)
        .input("SuDungDuLieuMau", sql.Bit, SuDungDuLieuMau)
        .execute('loginAndPermission_register_insertPartner');
      const IDDoiTac = resultInsertPartner.recordset[0].IDDoiTac;
      // //thêm tài khoản
      await pool.request()
        .input('TenDoanhNghiep', sql.NVarChar, TenDoanhNghiep)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .input('Email', sql.NVarChar, Email)
        .input('NgaySinh', sql.Date, NgaySinh)
        .input('MatKhau', sql.NVarChar, MatKhau)
        .input('DiaChi', sql.NVarChar, DiaChi)
        .input('SoDienThoai', sql.NVarChar, SoDienThoai)
        .input('NgayDangKy', sql.DateTime, NgayDangKy)
        .execute('loginAndPermission_register_insertAccount');
      return {
        success: true
      };
    }
  } catch (error) {
    throw error;
  }
}

//hàm đăng nhập
async function login(data) {
  try {
    const NgayHomNay = new Date();
    let res = await pool.request()
      .input('Email', sql.VarChar, data.Email)
      .input('NgayHomNay', sql.DateTime, NgayHomNay)
      .execute('loginAndPermission_login_getListUsers');
    if (res !== undefined && res.recordset.length > 0 && res.recordset[0].MatKhau) {
      let matchedUser;
      for (const user of res.recordset) {
        const isPasswordMatch = await bcrypt.compare(data.MatKhau, user.MatKhau);
        if (isPasswordMatch) {
          console.log('mật khẩu chính xác');
          matchedUser = user;
          break;
        }
      }
      if (matchedUser) {
        console.log("Tài khoản đã đăng nhập: ", matchedUser);
        const IDNhanVien = matchedUser.IDNhanVien; // Lấy ID từ người dùng khớp
        // Đăng nhập thành công
        const currentTime = Date.now().toString();
        const secret = "VRes"; // Thay đổi chuỗi bí mật thành giá trị thực tế
        const MaDangNhap = bcrypt.hashSync(currentTime + secret, 10);
        //thêm 3 ngày thời hạn
        const currentTime2 = Date.now();

        const threeDaysLater = new Date(currentTime2 + (3 * 24 * 60 * 60 * 1000));
        const result = await pool.request()
          .input('MaDangNhap', sql.NVarChar, MaDangNhap)
          .input('HanDangNhap', sql.DateTime, threeDaysLater)
          .input('IDNhanVien', sql.Int, IDNhanVien)
          .query('EXEC loginAndPermission_login_updateUserLogin @MaDangNhap, @HanDangNhap, @IDNhanVien');
        if (result.rowsAffected[0] === 1)
          return {
            success: true,
            message: 'Đăng nhập thành công!',
            cookieValue: MaDangNhap,
            IDDoiTac: matchedUser.IDDoiTac
          }
        else {
          return {
            success: false,
            message: "Có lỗi xảy ra trong quá trình đăng nhập.",
          };
        }
      } else {
        // Mật khẩu không khớp
        return {
          success: false,
          message: "Email hoặc mật khẩu không chính xác!",
        };
      }
    } else {
      console.log('không tìm thấy email');
      // Người dùng không tồn tại
      return {
        success: false,
        message: "Email hoặc mật khẩu không chính xác!",
      };
    }
  } catch (error) {
    throw error;
  }
}
//hàm kiểm tra phiên đăng nhập
async function session(MaDangNhap) {
  try {//kiểm tra thông tin đăng nhập từ mã đăng nhập
    const NgayHomNay = new Date();
    let result = await pool.request()
      .input("MaDangNhap", sql.NVarChar, MaDangNhap.ss)
      .input('NgayHomNay', sql.DateTime, NgayHomNay)
      .execute('loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap');
    if (result.recordset.length === 0) {
      return { success: false, message: "Bạn hãy đăng nhập lại!" };
    } else {//nếu mã đăng nhập hợp lệ thì kiểm tra hạn đăng nhập
      const timeSession = result.recordset[0].HanDangNhap;
      const currentTime = new Date();
      if (currentTime > timeSession) {
        return { success: false, message: "Đăng Nhập Đã Hết Hạn!" };
      } else {//thực hiện trả menu cho front-end
        let resultNhomQuyen = await pool
          .request()
          .input('IDNhanVien', sql.Int, result.recordset[0].IDNhanVien)
          .query('EXEC loginAndPermission_checkSessionAndRole_getPermissionByIDNhanVien @IDNhanVien');
        let menu = [];
        const permissions = resultNhomQuyen.recordset.map((row) => row.NhomQuyen);;
        for (const p of permissions) {
          if (menu.includes(p)) {
            //nếu như tên nhóm quyền đã nằm trong mảng thì không làm gì
          } else {
            menu.push(p);//nếu chưa có thì thêm vào mảng
          }
        }
        const getLogo = await pool.request()
          .input("IDDoiTac", sql.UniqueIdentifier, result.recordset[0].IDDoiTac)
          .execute('loginAndPermission_checkSessionAndRole_getLogo');
        if (await checkSessionAndRole(MaDangNhap.ss, 'insertCloseShifts')) {
          const date = new Date();
          const yyyy = date.getFullYear();
          const mm = date.getMonth() + 1;
          const dd = date.getDate();
          const currentDate = `${yyyy}-${mm < 10 ? `0${mm}` : mm}-${dd < 10 ? `0${dd}` : dd}`;

          const resultChotCa = await pool.request()
            .input('IDNhanVien', sql.Int, result.recordset[0].IDNhanVien)
            .input('NgayLamViec', sql.DateTime, currentDate)
            .execute('shifts_login_getChotCaByIDNhanVienNgayLamViec');

          if (resultChotCa.recordset.length > 0)
            // viết code xử lý vào đây
            return {
              success: true,
              NhanVien: result.recordset[0],
              menu: menu,
              ChotCa: true,
              shiftsNotClosed: true,
              listShiftsNotClosed: resultChotCa.recordset,
              Logo: getLogo.recordset[0].Logo
            }
          else return {
            success: true,
            NhanVien: result.recordset[0],
            menu: menu,
            ChotCa: true,
            Logo: getLogo.recordset[0].Logo
          };
        }
        else return {
          success: true,
          NhanVien: result.recordset[0],
          menu: menu,
          Logo: getLogo.recordset[0].Logo
        };
      }
    }
  } catch (error) {
    throw error;
  }
}

//xử lý đăng xuất
async function logout(MaDangNhap) {
  try {
    const result = await pool.request()
      .input('MaDangNhap', sql.NVarChar, MaDangNhap)
      .query('EXEC loginAndPermission_logout_logout @MaDangNhap');
    if (result.rowsAffected[0] === 1) {
      return {
        success: true,
        message: 'Đăng Xuất Thành Công'
      };
    } else {
      return {
        success: false,
        message: 'Đăng Xuất Không Thành Công'
      };
    }
  } catch (error) {
    throw error;
  }
}
//hàm đổi mật khẩu
async function changePassword(ss, MatKhauCu, MatKhauMoi) {
  try {//kiểm tra thông tin đăng nhập từ mã đăng nhập
    const NgayHomNay = new Date();
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .input('NgayHomNay', sql.DateTime, NgayHomNay)
      .execute('loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap');

    if (result.recordset.length === 0) {
      return { success: false, message: "Bạn hãy đăng nhập lại!" };
    } else {//nếu mã đăng nhập hợp lệ thì kiểm tra hạn đăng nhập
      const timeSession = result.recordset[0].HanDangNhap;
      const currentTime = new Date();
      if (currentTime > timeSession) {
        return { success: false, message: "Đăng Nhập Đã Hết Hạn!" };
      } else {
        // đã xác thực tài khoản
        // kiểm tra mật khẩu cũ:
        console.log('result.recordset', result.recordset);
        console.log('MatKhauCu', MatKhauCu);
        console.log('result.recordset[0].MatKhau', result.recordset[0].MatKhau);
        const isPasswordMatch = await bcrypt.compare(MatKhauCu, result.recordset[0].MatKhau);
        if (isPasswordMatch) {
          // mật khẩu cũ khớp
          // mã hoá mật khẩu mới 
          const BamMatKhauMoi = await bcrypt.hash(MatKhauMoi, 10)
          //cập nhật mật khẩu mới
          await pool.request()
            .input("IDNhanVien", sql.Int, result.recordset[0].IDNhanVien)
            .input("MaDangNhap", sql.NVarChar, ss)
            .input("MatKhauMoi", sql.NVarChar, BamMatKhauMoi)
            .execute('loginAndPermission_changePassword');
          return { success: true, message: "Đổi mật khẩu thành công!" };
        } else
          return { success: false, message: "Mật Khẩu Cũ Không Chính Xác" };
      }
    }
  } catch (error) {
    throw error;
  }
}


//xử lý tải dữ liệu tài khoản
async function getAccount(IDDoiTac) {
  try {
    let result = await pool.request()
      .input("IDDoiTac", sql.NVarChar, IDDoiTac)
      .query('EXEC employee_getAccount_getAccount @IDDoiTac');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý thêm dữ liệu tài khoản
async function insertAccount(IDDoiTac, data) {
  try {
    // Hash mật khẩu nếu có
    const hashedPassword = typeof data.MatKhau === 'undefined' ? null : await bcrypt.hash(data.MatKhau, 10);

    // Thiết lập giá trị mặc định cho IDVaiTro và Email
    const IDVaiTro = typeof data.IDVaiTro === 'undefined' ? null : data.IDVaiTro;
    const Email = typeof data.Email === 'undefined' ? null : data.Email;

    if (Email) {
      // Kiểm tra email đã được đăng ký chưa
      const resultCheckEmail = await pool.request()
        .input("Email", sql.NVarChar, Email)
        .execute("loginAndPermission_register_checkEmail");

      const CheckEmail = resultCheckEmail.recordset[0]?.[''];

      if (CheckEmail) {
        // Return thông báo nếu email đã được sử dụng
        return {
          success: false,
          message: 'Email đã được sử dụng'
        };
      }
    }

    // Thực hiện chèn dữ liệu
    await pool.request()
      .input('TenNhanVien', sql.NVarChar, data.TenNhanVien)
      .input('IDViTriCongViec', sql.Int, data.IDViTriCongViec)
      .input('Email', sql.VarChar, Email)
      .input('MatKhau', sql.NVarChar, hashedPassword)
      .input('NgaySinh', sql.Date, data.NgaySinh)
      .input('GioiTinh', sql.NVarChar, data.GioiTinh)
      .input('DiaChi', sql.NVarChar, data.DiaChi)
      .input('SoDienThoai', sql.NVarChar, data.SoDienThoai)
      .input('TinhTrang', sql.NVarChar, data.TinhTrang)
      .input('NgayVao', sql.Date, data.NgayVao)
      .input('IDVaiTro', sql.NVarChar, IDVaiTro)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .execute('employee_insertAccount_insertAccount');

    return { success: true, message: "Thêm Dữ Liệu Thành Công!" };

  } catch (error) {
    throw error;
  }
}


//xử lý sửa tài khoản
async function updateAccount(IDDoiTac, data) {
  try {
    var hashedPassword = null
    if (typeof data.MatKhau === 'undefined' || data.MatKhau === '')
      hashedPassword = null
    else hashedPassword = await bcrypt.hash(data.MatKhau, 10)
    // var hashedPassword = typeof data.MatKhau === 'undefined' ? null : await bcrypt.hash(data.MatKhau, 10);
    // hashedPassword = data.MatKhau === '' ? null : await bcrypt.hash(data.MatKhau, 10);
    var IDVaiTro = data.IDVaiTro
    var Email = data.Email
    if (typeof data.IDVaiTro === 'undefined' || data.IDVaiTro.length === 0) {
      IDVaiTro = null
      Email = null
    }
    console.log('MatKhau', hashedPassword);

    await pool.request()
      .input('IDNhanVien', sql.Int, data.IDNhanVien)
      .input('TenNhanVien', sql.NVarChar, data.TenNhanVien)
      .input('IDViTriCongViec', sql.Int, data.IDViTriCongViec)
      .input('Email', sql.VarChar, Email)
      .input('MatKhau', sql.NVarChar, hashedPassword)
      .input('NgaySinh', sql.Date, data.NgaySinh)
      .input('GioiTinh', sql.NVarChar, data.GioiTinh)
      .input('DiaChi', sql.NVarChar, data.DiaChi)
      .input('SoDienThoai', sql.NVarChar, data.SoDienThoai)
      .input('TinhTrang', sql.NVarChar, data.TinhTrang)
      .input('NgayVao', sql.Date, data.NgayVao)
      .input('IDVaiTro', sql.NVarChar, IDVaiTro)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .execute('employee_updateAccount_updateAccount');

    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
//xử lý lấy danh sách vai trò theo id
async function getListRoleByIDAccount(IDDoiTac, ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .execute('employee_getAccount_getListRoleByIDAccount');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá tài khoản
async function deleteAccount(IDDoiTac, ID) {
  try {
    await pool.request()
      .input('IDNhanVien', sql.Int, ID)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .execute('employee_deleteAccount_deleteAccount');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}

//Hàm khôi phục dữ liệu đã xoá
async function undoDeleteAccount(IDDoiTac, ID) {
  try {
    let res = await pool.request()
      .input('IDNhanVien', sql.Int, ID)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .execute('employee_undoDeleteAccount_undoDeleteAccount');
  } catch (error) {
    throw error;
  }
}









//xử lý tải danh sách vai trò
async function getRole(IDDoiTac) {
  try {
    let result = await pool.request()
      .input("IDDoiTac", sql.NVarChar, IDDoiTac)
      .query('EXEC employee_getRole_getRole @IDDoiTac');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy quyền của vai trò theo id vai trò
async function getListPermissionByIDRole(ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('employee_getRole_getListPermissionByIDRole');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý thêm dữ liệu vai trò
async function insertRole(IDDoiTac, data) {
  try {
    await pool.request()
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .input('TenVaiTro', sql.NVarChar, data.TenVaiTro)
      .input('IDQuyen', sql.NVarChar, data.IDQuyen)
      .execute('employee_insertRole_insertRole');
    return { success: true, message: "Thêm Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
//xử lý tải danh sách quyền
async function getPermission() {
  try {
    let result = await pool.request().execute('employee_getPermission_getPermission');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý sửa vai trò truy cập
async function updateRole(IDDoiTac, data) {
  try {
    const result = await pool.request()
      .input('IDVaiTro', sql.Int, data.IDVaiTro)
      .input('TenVaiTro', sql.NVarChar, data.TenVaiTro)
      .input('IDQuyen', sql.NVarChar, data.IDQuyen)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .execute('employee_updateRole_updateRole');
    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
//Hàm xoá vai trò truy cập
async function deleteRole(IDDoiTac, ID) {
  try {
    await pool.request()
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .input('IDVaiTro', sql.Int, ID)
      .execute('employee_deleteRole_deleteRole');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}




//xử lý tải danh sách vị trí công việc
async function getJobPosition(IDDoiTac) {
  try {
    let result = await pool.request()
      .input("IDDoiTac", sql.NVarChar, IDDoiTac)
      .query('EXEC employee_getJobPosition_getJobPosition @IDDoiTac')
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//Hàm xoá vai trò truy cập
async function deleteJobPosition(IDDoiTac, ID) {
  try {
    const result = await pool.request()
      .input('IDViTriCongViec', sql.Int, ID)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .execute('employee_deleteJobPosition_deleteJobPosition');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}

//xử lý thêm vị trí công việc
async function insertJobPosition(IDDoiTac, data) {
  try {
    let MoTa = null;
    if (typeof data.MoTa === 'undefined')
      MoTa = null;
    else MoTa = data.MoTa;
    await pool.request()
      .input('TenViTriCongViec', sql.NVarChar, data.TenViTriCongViec)
      .input('MoTa', sql.NVarChar, MoTa)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .execute('employee_insertJobPosition_insertJobPosition');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật vị trí công việc
async function updateJobPosition(IDDoiTac, data) {
  try {
    let MoTa = null;
    if (typeof data.MoTa === 'undefined')
      MoTa = null;
    else MoTa = data.MoTa;
    await pool.request()
      .input('IDViTriCongViec', sql.Int, data.IDViTriCongViec)
      .input('TenViTriCongViec', sql.NVarChar, data.TenViTriCongViec)
      .input('MoTa', sql.NVarChar, MoTa)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .execute('employee_updateJobPosition_updateJobPosition');
    return { success: true };
  } catch (error) {
    throw error;
  }
}





//Xử lý sửa dữ liệu hàng loạt
async function getDataSelected(recordIds) {
  try {
    let pool = await sql.connect(config);
    let res = await pool.request().query(`SELECT * FROM HoaDon WHERE SoHD IN (${recordIds})`);

    if (res.recordset.length > 0) {
      const result = res.recordset.map(row => {
        const ngayHoaDon = format(new Date(row.NgayHD), 'dd-MM-yyyy');
        const ngayGiao = format(new Date(row.NgayGiao), 'dd-MM-yyyy');
        return {
          SoHD: row.SoHD,
          NgayHD: ngayHoaDon,
          NgayGiao: ngayGiao,
          MaKH: row.MaKH,
          MaNV: row.MaNV
        };
      });
      return result;
    }
  } catch (error) {
    console.log(" mathus-error :" + error);
    throw error;
  }
}
//hàm đăng nhập 
async function loginSuperAdmin(data) {
  try {
    const nowTime = new Date(); // Sử dụng Date() để tạo đối tượng Date từ số mili giây hiện tại
    // Thời gian sau 15 phút
    const fifteenMinutesBefore = new Date(nowTime.getTime() - 15 * 60 * 1000); 

    // kiểm tra email đã được  đăng ký chưa
    const resultCheckEmail = await pool.request()
      .input("Email", sql.NVarChar, data.Email)
      .execute("loginAndPermission_register_checkEmailLoginSuperAdmin");
    const CheckEmail = resultCheckEmail.recordset[0][''];
    if (CheckEmail) {
      // cấu hình email
      let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'dangtuanthanh265@gmail.com',
          pass: 'jjgkyyjscrysbxsy' // Sử dụng biến môi trường EMAIL_PASSWORD
        }
      });
      const randomCode = generateRandomCode2()
      console.log('randomCode', randomCode);
      let mailOptions = {
        from: 'dangtuanthanh265@gmail.com',
        to: `${data.Email}`,
        subject: 'Mã xác thực đăng nhập',
        text: `Chào bạn. Đây là mã xác thực đăng nhập tài khoản của bạn: ${randomCode}`
      };
      await transporter.sendMail(mailOptions, async function (error, info) {
        if (error) {
          throw error;
        } else {
          //sau khi gửi email, lưu mã vào csdl
          await pool.request()
            .input('fifteenMinutesLater', sql.DateTime, fifteenMinutesBefore)
            .input("Email", sql.NVarChar, data.Email)
            .input("MaXacThuc", sql.Int, randomCode)
            .execute("loginAndPermission_register_saveEmailAndCodeLoginSuperAdmin");

        }
      });
      return {
        success: true
      };
    } else {
      console.log('không tìm thấy email');
      // Người dùng không tồn tại
      return {
        success: false,
        message: "Email không chính xác!",
      };
    }

  } catch (error) {
    console.error("Error during login:", error);
    return {
      success: false,
      message: 'Đã xảy ra lỗi trong quá trình xử lý',
      error: error.message
    };
  }
}

// tạo ngẫu nhiên chữ số:
function generateRandomCode2() {
  let code = '';
  const possible = '0123456789';
  for (let i = 0; i < 6; i++) {
    code += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return code;
}
async function registerCodeLoginSuperAdmin(Code) {
  try {
    const nowTime = new Date(); // Sử dụng Date() để tạo đối tượng Date từ số mili giây hiện tại
// Thời gian sau 15 phút
const fifteenMinutesLater = new Date(nowTime.getTime() + 15 * 60 * 1000); 
    
    const result = await pool.request()
      .input('Code', sql.Int, Code)
      .input('fifteenMinutesLater', sql.DateTime, fifteenMinutesLater)
      .execute('loginAndPermission_register_verificationCodeLoginSuperAdmin');
    if (result.recordset.length === 0) {
      return {
        success: false,
        message: 'Mã Xác Thực Không Chính Xác'
      };
    } else {
      return {
        success: true, loginsuperadmin: Code
      };
    }
  } catch (error) {
    throw error;
  }
}
//Kiểm tra phiên và quyền đăng nhập
async function checkSessionSuperAdmin(ss) {
  try {
    //thời gian sau đó 15p
    const nowTime = new Date()
    const fifteenMinutesLater = new Date(nowTime.getTime() + 15 * 60 * 1000);
    let result = await pool
      .request()
      .input("MaXacThuc", sql.Int, ss)
      .input('nowTime', sql.DateTime, nowTime)
      .input('fifteenMinutesLater', sql.DateTime, fifteenMinutesLater)
      .execute('loginAndPermission_checkSessionSuperAdmin');
    if (result.recordset.length === 0) {
      return false;
    } else
      return true; // Nếu không tìm thấy quyền nào khớp với biến permission, trả về false
  } catch (error) {
    throw error;
  }
}
//xử lý tải dữ liệu tài khoản
async function getPartner() {
  try {
    let result = await pool.request()
      .query('EXEC loginAndPermission_getPartner');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá vai trò truy cập
async function deletePartner(ID) {
  try {
    await pool.request()
      .input('ID', sql.UniqueIdentifier, ID)
      .execute('loginAndPermission_deletePartner');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
//Hàm xoá vai trò truy cập
async function resetDataByIDDoiTac(ID) {
  try {
    const MatKhau = await bcrypt.hash("1234", 10)
    await pool.request()
      .input('IDDoiTac', sql.UniqueIdentifier, ID)
      .input('MatKhau', sql.NVarChar, MatKhau)
      .execute('global_resetDataByIDDoiTac');
    return { ID, success: true, message: "Đặt Lại Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  login: login,
  session: session,
  logout: logout,
  getAccount: getAccount,
  insertAccount: insertAccount,
  getRole: getRole,
  getJobPosition: getJobPosition,
  updateAccount: updateAccount,
  getListRoleByIDAccount: getListRoleByIDAccount,
  deleteAccount: deleteAccount,
  undoDeleteAccount: undoDeleteAccount,
  getListPermissionByIDRole: getListPermissionByIDRole,
  insertRole: insertRole,
  getPermission: getPermission,
  updateRole: updateRole,
  deleteRole: deleteRole,
  deleteJobPosition: deleteJobPosition,
  insertJobPosition: insertJobPosition,
  updateJobPosition: updateJobPosition,
  changePassword: changePassword,
  register: register,
  getDataSelected: getDataSelected,
  registerCode: registerCode,
  getIDDoiTac: getIDDoiTac,
  loginSuperAdmin: loginSuperAdmin,
  registerCodeLoginSuperAdmin: registerCodeLoginSuperAdmin,
  checkSessionSuperAdmin: checkSessionSuperAdmin,
  getPartner: getPartner,
  deletePartner: deletePartner,
  resetDataByIDDoiTac:resetDataByIDDoiTac
};
