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
    NgayHomNay.setMinutes(NgayHomNay.getMinutes() - NgayHomNay.getTimezoneOffset());
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
      const MatKhau = await bcrypt.hash(result.recordset[0]['MatKhau'], 10)
      const DiaChi = result.recordset[0]['DiaChi']
      const SoDienThoai = result.recordset[0]['SoDienThoai']
      const SuDungDuLieuMau = result.recordset[0]['SuDungDuLieuMau']
      //thêm đối tác
      const NgayDangKy = new Date();
      const NgayHetHan = new Date(NgayDangKy.getTime() + (7 * 24 * 60 * 60 * 1000));
      // Bắt đầu một transaction
      const transaction = new sql.Transaction(pool);
      try {
        // Bắt đầu transaction
        await transaction.begin();
        // Tạo một request trong transaction
        const request = new sql.Request(transaction);

        //thêm tài khoản
        const resultInsertPartner = await request
          .input('TenDoanhNghiep', sql.NVarChar, TenDoanhNghiep)
          .input('Email', sql.NVarChar, Email)
          .input('NgaySinh', sql.Date, NgaySinh)
          .input('MatKhau', sql.NVarChar, MatKhau)
          .input('DiaChi', sql.NVarChar, DiaChi)
          .input('SoDienThoai', sql.NVarChar, SoDienThoai)
          .input('NgayDangKy', sql.DateTime, NgayDangKy)
          .input('NgayHetHan', sql.DateTime, NgayHetHan)
          .input("SuDungDuLieuMau", sql.Bit, SuDungDuLieuMau)
          .execute('loginAndPermission_register_insertAccount');
        const IDDoiTac = resultInsertPartner.recordset[0].IDDoiTac;
        //thêm dữ liệu mẫu 
        console.log('SuDungDuLieuMau', SuDungDuLieuMau);
        if (SuDungDuLieuMau) {
          await addSampleData(transaction, '4a7666cf-0da4-4f4b-b546-b0e67c1e4c08', IDDoiTac)
        }
        // Nếu không có lỗi, commit transaction
        await transaction.commit();
      } catch (err) {
        // Nếu có lỗi, rollback transaction
        console.log('err', err);

        await transaction.rollback();
        return {
          success: false
        };
      }
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
    NgayHomNay.setMinutes(NgayHomNay.getMinutes() - NgayHomNay.getTimezoneOffset());
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
    const NgayHomNay = new Date(new Date().toISOString());
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
          console.log('result.recordset[0].IDNhanVien', result.recordset[0].IDNhanVien);
          console.log('currentDate', NgayHomNay);

          const resultChotCa = await pool.request()
            .input('IDNhanVien', sql.Int, result.recordset[0].IDNhanVien)
            .input('NgayLamViec', sql.DateTime, NgayHomNay)
            .execute('shifts_login_getChotCaByIDNhanVienNgayLamViec');
          console.log('resultChotCa.recordset', resultChotCa.recordset);

          if (resultChotCa.recordset.length > 0)
            // viết code xử lý vào đây
            return {
              success: true,
              NhanVien: result.recordset[0],
              menu: menu,
              ChotCa: true,
              shiftsNotClosed: true,
              listShiftsNotClosed: resultChotCa.recordset,
              Logo: getLogo.recordset[0].Logo,
              DiaChi: getLogo.recordset[0].DiaChi
            }
          else return {
            success: true,
            NhanVien: result.recordset[0],
            menu: menu,
            ChotCa: true,
            Logo: getLogo.recordset[0].Logo,
            DiaChi: getLogo.recordset[0].DiaChi
          };
        }
        else return {
          success: true,
          NhanVien: result.recordset[0],
          menu: menu,
          Logo: getLogo.recordset[0].Logo,
          DiaChi: getLogo.recordset[0].DiaChi
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
    NgayHomNay.setMinutes(NgayHomNay.getMinutes() - NgayHomNay.getTimezoneOffset());
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




//hàm thêm dữ liệu mẫu
//khoảng 20 giây
async function addSampleData(transaction, IDDoiTacCu, IDDoiTac) {
  try {
    console.log("thêm dữ liệu mẫu cho IDDoiTac: ", IDDoiTac);

    var request = new sql.Request(transaction);
    //#region khách hàng
    request = new sql.Request(transaction); // Tạo request mới
    let khachHangMapping = [];
    // lấy danh sách khách hàng cũ
    const khachHangOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
    SELECT * FROM KhachHang 
    WHERE IDDoiTac = @IDDoiTacCu
  `);
    // thêm dữ liệu mới vào bảng khách hàng
    for (let kh of khachHangOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const result = await requestInsert
        .input('TenKhachHang', sql.NVarChar, kh.TenKhachHang)
        .input('SoDienThoai', sql.NVarChar, kh.SoDienThoai)
        .input('DiemTichLuy', sql.Int, kh.DiemTichLuy)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
      INSERT INTO KhachHang 
      (TenKhachHang, SoDienThoai, DiemTichLuy, IDDoiTac)
      VALUES (@TenKhachHang, @SoDienThoai, @DiemTichLuy, @IDDoiTac);
      SELECT SCOPE_IDENTITY() AS NewID
    `);

      khachHangMapping.push({ OldID: kh.IDKhachHang, NewID: result.recordset[0].NewID });
    }
    //#endregion


    //#region vị trí công việc
    request = new sql.Request(transaction); // Tạo request mới
    let viTriCongViecMapping = [];

    // Lấy danh sách vị trí công việc cũ
    const viTriCongViecOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
    SELECT * FROM ViTriCongViec
    WHERE IDDoiTac = @IDDoiTacCu
    AND IDViTriCongViec <> 1
  `);

    // Thêm dữ liệu mới vào bảng vị trí công việc
    for (let vt of viTriCongViecOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const result = await requestInsert
        .input('TenViTriCongViec', sql.NVarChar, vt.TenViTriCongViec)
        .input('MoTa', sql.NVarChar, vt.MoTa)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
      INSERT INTO ViTriCongViec (TenViTriCongViec, MoTa, IDDoiTac)
      VALUES (@TenViTriCongViec, @MoTa, @IDDoiTac);
      SELECT SCOPE_IDENTITY() AS NewID
    `);

      viTriCongViecMapping.push({ OldID: vt.IDViTriCongViec, NewID: result.recordset[0].NewID });
    }
    //#endregion


    //#region nhân viên
    request = new sql.Request(transaction); // Tạo request mới
    let nhanVienMapping = [];
    // lấy danh sách nhân viên cũ
    const nhanVienOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT * FROM NhanVien 
        WHERE IDDoiTac = @IDDoiTacCu
        AND IDNhanVien NOT IN (120007, 120020)
      `);

    //thêm dữ liệu mới vào bảng nhân viên
    for (let nv of nhanVienOld.recordset) {
      let requestInsert = new sql.Request(transaction);

      const newIDViTriCongViec = viTriCongViecMapping.find(vt => vt.OldID === nv.IDViTriCongViec)?.NewID;
      const result = await requestInsert
        .input('TenNhanVien', sql.NVarChar, nv.TenNhanVien)
        .input('IDViTriCongViec', sql.Int, newIDViTriCongViec)
        .input('TaiKhoan', sql.NVarChar, nv.TaiKhoan)
        .input('Email', sql.NVarChar, nv.Email)
        .input('MatKhau', sql.NVarChar, nv.MatKhau)
        .input('NgaySinh', sql.DateTime, nv.NgaySinh)
        .input('GioiTinh', sql.NVarChar, nv.GioiTinh)
        .input('DiaChi', sql.NVarChar, nv.DiaChi)
        .input('SoDienThoai', sql.NVarChar, nv.SoDienThoai)
        .input('TinhTrang', sql.NVarChar, nv.TinhTrang)
        .input('NgayVao', sql.DateTime, nv.NgayVao)
        .input('HinhAnh', sql.NVarChar, nv.HinhAnh)
        .input('MaDangNhap', sql.NVarChar, nv.MaDangNhap)
        .input('HanDangNhap', sql.DateTime, nv.HanDangNhap)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
            INSERT INTO NhanVien 
            (TenNhanVien, IDViTriCongViec, TaiKhoan, Email, MatKhau, NgaySinh, GioiTinh, DiaChi, SoDienThoai, TinhTrang, NgayVao, HinhAnh, MaDangNhap, HanDangNhap, IDDoiTac)
            VALUES (@TenNhanVien, @IDViTriCongViec, @TaiKhoan, @Email, @MatKhau, @NgaySinh, @GioiTinh, @DiaChi, @SoDienThoai, @TinhTrang, @NgayVao, @HinhAnh, @MaDangNhap, @HanDangNhap, @IDDoiTac);
            SELECT SCOPE_IDENTITY() AS NewID
          `);

      nhanVienMapping.push({ OldID: nv.IDNhanVien, NewID: result.recordset[0].NewID });
    }
    //#endregion

    //#region khu vực
    request = new sql.Request(transaction); // Tạo request mới
    let khuVucMapping = [];
    // Lấy danh sách khu vực cũ
    const khuVucOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
    SELECT * FROM KhuVuc 
    WHERE IDDoiTac = @IDDoiTacCu
  `);
    // Thêm dữ liệu mới vào bảng khu vực
    for (let kv of khuVucOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const result = await requestInsert
        .input('TenKhuVuc', sql.NVarChar, kv.TenKhuVuc)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
      INSERT INTO KhuVuc 
      (TenKhuVuc, IDDoiTac)
      VALUES (@TenKhuVuc, @IDDoiTac);
      SELECT SCOPE_IDENTITY() AS NewID
    `);

      khuVucMapping.push({ OldID: kv.IDKhuVuc, NewID: result.recordset[0].NewID });
    }
    //#endregion


    //#region bàn
    request = new sql.Request(transaction); // Tạo request mới
    let banMapping = [];
    // Lấy danh sách bàn cũ
    const banOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
    SELECT * FROM Ban 
    WHERE IDDoiTac = @IDDoiTacCu
  `);

    // Thêm dữ liệu mới vào bảng bàn
    for (let ban of banOld.recordset) {
      let requestInsert = new sql.Request(transaction);

      // Tìm IDKhuVuc mới từ khuVucMapping
      const newIDKhuVuc = khuVucMapping.find(kv => kv.OldID === ban.IDKhuVuc)?.NewID;

      const result = await requestInsert
        .input('TenBan', sql.NVarChar, ban.TenBan)
        .input('TrangThai', sql.NVarChar, ban.TrangThai)
        .input('GhiChu', sql.NVarChar, ban.GhiChu)
        .input('IDKhuVuc', sql.Int, newIDKhuVuc)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
      INSERT INTO Ban 
      (TenBan, TrangThai, GhiChu, IDKhuVuc, IDDoiTac)
      VALUES (@TenBan, @TrangThai, @GhiChu, @IDKhuVuc, @IDDoiTac);
      SELECT SCOPE_IDENTITY() AS NewID
    `);

      banMapping.push({ OldID: ban.IDBan, NewID: result.recordset[0].NewID });
    }
    //#endregion


    //#region hoá đơn
    request = new sql.Request(transaction); // Tạo request mới
    let hoaDonMapping = [];

    // Lấy danh sách hóa đơn cũ
    const hoaDonOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
    SELECT * FROM HoaDon
    WHERE IDDoiTac = @IDDoiTacCu;
  `);

    // Thêm dữ liệu mới vào bảng HoaDon và lấy ID mới
    for (let hd of hoaDonOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const ngaylaphd = new Date(new Date(hd.NgayLapHoaDon).setMonth(new Date().getMonth())).toISOString().slice(0, 19).replace('T', ' ')
      // Tìm IDBan, IDNhanVien, IDKhachHang mới từ các mapping tương ứng
      const newIDBan = banMapping.find(b => b.OldID === hd.IDBan)?.NewID;
      const newIDNhanVien = nhanVienMapping.find(nv => nv.OldID === hd.IDNhanVien)?.NewID;
      const newIDKhachHang = khachHangMapping.find(kh => kh.OldID === hd.IDKhachHang)?.NewID;

      const result = await requestInsert
        .input('IDBan', sql.Int, newIDBan)
        .input('IDNhanVien', sql.Int, newIDNhanVien)
        .input('IDKhachHang', sql.Int, newIDKhachHang)
        .input('TenKhuVuc', sql.NVarChar, hd.TenKhuVuc)
        .input('NgayLapHoaDon', sql.DateTime, ngaylaphd)
        .input('TrangThaiThanhToan', sql.Bit, hd.TrangThaiThanhToan)
        .input('ThanhToanChuyenKhoan', sql.Bit, hd.ThanhToanChuyenKhoan)
        .input('TongTien', sql.Decimal, hd.TongTien)
        .input('GhiChu', sql.NVarChar, hd.GhiChu)
        .input('PhuongThucGiamGia', sql.NVarChar, hd.PhuongThucGiamGia)
        .input('GiamGia', sql.Decimal, hd.GiamGia)
        .input('SuDungDiemKhachHang', sql.Bit, hd.SuDungDiemKhachHang)
        .input('DiemKhachHang', sql.Int, hd.DiemKhachHang)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
      INSERT INTO HoaDon (IDBan, IDNhanVien, IDKhachHang, TenKhuVuc, NgayLapHoaDon, TrangThaiThanhToan, ThanhToanChuyenKhoan, TongTien, GhiChu, PhuongThucGiamGia, GiamGia, SuDungDiemKhachHang, DiemKhachHang, IDDoiTac)
      VALUES (@IDBan, @IDNhanVien, @IDKhachHang, @TenKhuVuc, @NgayLapHoaDon, @TrangThaiThanhToan, @ThanhToanChuyenKhoan, @TongTien, @GhiChu, @PhuongThucGiamGia, @GiamGia, @SuDungDiemKhachHang, @DiemKhachHang, @IDDoiTac);
      SELECT SCOPE_IDENTITY() AS NewID;
    `);
      hoaDonMapping.push({ OldID: hd.IDHoaDon, NewID: result.recordset[0].NewID });
    }
    console.log('hoá đơn');
    //#endregion

    //#region đơn vị tính
    request = new sql.Request(transaction); // Tạo request mới
    let donViTinhMapping = [];

    // Lấy danh sách đơn vị tính cũ
    const donViTinhOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT * FROM DonViTinh
        WHERE IDDoiTac = @IDDoiTacCu;
      `);

    // Thêm dữ liệu mới vào bảng DonViTinh và lấy ID mới
    for (let dv of donViTinhOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const result = await requestInsert
        .input('TenDonViTinh', sql.NVarChar, dv.TenDonViTinh)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
          INSERT INTO DonViTinh (TenDonViTinh, IDDoiTac)
          VALUES (@TenDonViTinh, @IDDoiTac);
          SELECT SCOPE_IDENTITY() AS NewID;
        `);

      // Thêm ánh xạ ID vào mảng
      donViTinhMapping.push({ OldID: dv.IDDonViTinh, NewID: result.recordset[0].NewID });
    }
    console.log('đơn vị tính');
    //#endregion

    //#region sản phẩm
    request = new sql.Request(transaction); // Tạo request mới
    let sanPhamMapping = [];

    // Lấy danh sách sản phẩm cũ
    const sanPhamOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT * FROM SanPham
        WHERE IDDoiTac = @IDDoiTacCu;
      `);

    // Thêm dữ liệu mới vào bảng SanPham và lấy ID mới
    for (let sp of sanPhamOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      // Tìm IDDonViTinh mới từ donViTinhMapping
      const newIDDonViTinh = donViTinhMapping.find(dvt => dvt.OldID === sp.IDDonViTinh)?.NewID;
      const result = await requestInsert
        .input('TenSanPham', sql.NVarChar, sp.TenSanPham)
        .input('HinhAnh', sql.NVarChar, sp.HinhAnh)
        .input('MoTa', sql.NVarChar, sp.MoTa)
        .input('SanPhamThanhPham', sql.Bit, sp.SanPhamThanhPham)
        .input('IDDonViTinh', sql.Int, newIDDonViTinh)
        .input('SoLuongTon', sql.Int, sp.SoLuongTon)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
          INSERT INTO SanPham (TenSanPham, HinhAnh, MoTa, SanPhamThanhPham, IDDonViTinh, SoLuongTon, IDDoiTac)
          VALUES (@TenSanPham, @HinhAnh, @MoTa, @SanPhamThanhPham, @IDDonViTinh, @SoLuongTon, @IDDoiTac);
          SELECT SCOPE_IDENTITY() AS NewID;
        `);

      // Thêm ánh xạ ID vào mảng
      sanPhamMapping.push({ OldID: sp.IDSanPham, NewID: result.recordset[0].NewID });
    }
    console.log('sản phẩm');
    //#endregion

    //#region nguyên liệu
    request = new sql.Request(transaction); // Tạo request mới
    let nguyenLieuMapping = [];

    // Lấy danh sách nguyên liệu cũ
    const nguyenLieuOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT * FROM NguyenLieu
        WHERE IDDoiTac = @IDDoiTacCu;
      `);

    // Thêm dữ liệu mới vào bảng NguyenLieu và lấy ID mới
    for (let nl of nguyenLieuOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      // Tìm IDDonViTinh mới từ donViTinhMapping
      const newIDDonViTinh = donViTinhMapping.find(dvt => dvt.OldID === nl.IDDonViTinh)?.NewID;
      const result = await requestInsert
        .input('TenNguyenLieu', sql.NVarChar, nl.TenNguyenLieu)
        .input('SoLuongTon', sql.Int, nl.SoLuongTon)
        .input('IDDonViTinh', sql.Int, newIDDonViTinh)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
          INSERT INTO NguyenLieu (TenNguyenLieu, SoLuongTon, IDDonViTinh, IDDoiTac)
          VALUES (@TenNguyenLieu, @SoLuongTon, @IDDonViTinh, @IDDoiTac);
          SELECT SCOPE_IDENTITY() AS NewID;
        `);

      // Thêm ánh xạ ID vào mảng
      nguyenLieuMapping.push({ OldID: nl.IDNguyenLieu, NewID: result.recordset[0].NewID });
    }
    console.log('nguyên liệu');
    //#endregion

    //#region chi tiết định mức
    request = new sql.Request(transaction); // Tạo request mới
    // Bước 1: Lấy thông tin chi tiết từ bảng ChiTietDinhMuc
    const chiTietDinhMucResult = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT IDSanPham, IDNguyenLieu, KhoiLuong, IDDonViTinh, TiLeSai
        FROM ChiTietDinhMuc
        WHERE IDDoiTac = @IDDoiTacCu
      `);

    // Bước 2: Tạo chiTietDinhMucMapping từ kết quả truy vấn
    let chiTietDinhMucMapping = [];
    for (let item of chiTietDinhMucResult.recordset) {
      const newSanPhamID = sanPhamMapping.find(sp => sp.OldID === item.IDSanPham)?.NewID;
      const newNguyenLieuID = nguyenLieuMapping.find(nl => nl.OldID === item.IDNguyenLieu)?.NewID;
      const newIDDonViTinh = donViTinhMapping.find(dvt => dvt.OldID === item.IDDonViTinh)?.NewID;
      if (newSanPhamID && newNguyenLieuID) {
        chiTietDinhMucMapping.push({
          IDSanPham: newSanPhamID,
          IDNguyenLieu: newNguyenLieuID,
          KhoiLuong: item.KhoiLuong,
          IDDonViTinh: newIDDonViTinh,
          TiLeSai: item.TiLeSai,
          IDDoiTac: IDDoiTac
        });
      }
    }

    // Bước 3: Thêm dữ liệu vào bảng ChiTietDinhMuc
    for (let item of chiTietDinhMucMapping) {
      let requestInsert = new sql.Request(transaction);
      await requestInsert
        .input('IDSanPham', sql.Int, item.IDSanPham)
        .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
        .input('KhoiLuong', sql.Decimal, item.KhoiLuong)
        .input('IDDonViTinh', sql.Int, item.IDDonViTinh)
        .input('TiLeSai', sql.Decimal, item.TiLeSai)
        .input('IDDoiTac', sql.UniqueIdentifier, item.IDDoiTac)
        .query(`
          INSERT INTO ChiTietDinhMuc (IDSanPham, IDNguyenLieu, KhoiLuong, IDDonViTinh, TiLeSai, IDDoiTac)
          VALUES (@IDSanPham, @IDNguyenLieu, @KhoiLuong, @IDDonViTinh, @TiLeSai, @IDDoiTac)
        `);
    }
    console.log('chi tiết định mức');
    //#endregion

    //#region phiếu nhập
    request = new sql.Request(transaction); // Tạo request mới
    let phieuNhapMapping = [];

    // Lấy danh sách phiếu nhập cũ
    const phieuNhapOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT * FROM PhieuNhap
        WHERE IDDoiTac = @IDDoiTacCu;
      `);

    // Thêm dữ liệu mới vào bảng PhieuNhap và lấy ID mới
    for (let pn of phieuNhapOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const newIDNhanVien = nhanVienMapping.find(nv => nv.OldID === pn.IDNhanVien)?.NewID;
      const result = await requestInsert
        .input('IDNhanVien', sql.Int, newIDNhanVien)
        .input('NgayNhap', sql.DateTime, pn.NgayNhap)
        .input('GhiChu', sql.NVarChar, pn.GhiChu)
        .input('NhapNguyenLieu', sql.Bit, pn.NhapNguyenLieu)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
          INSERT INTO PhieuNhap (IDNhanVien, NgayNhap, GhiChu, NhapNguyenLieu, IDDoiTac)
          VALUES (@IDNhanVien, @NgayNhap, @GhiChu, @NhapNguyenLieu, @IDDoiTac);
          SELECT SCOPE_IDENTITY() AS NewID;
        `);

      // Thêm ánh xạ ID vào mảng
      phieuNhapMapping.push({ OldID: pn.IDPhieuNhap, NewID: result.recordset[0].NewID });
    }
    //#endregion

    //#region ChiTietNhapSanPham
    request = new sql.Request(transaction); // Tạo request mới
    const chiTietNhapSanPhamOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
    SELECT 
      c.IDPhieuNhap, 
      c.IDSanPham, 
      c.SoLuongNhap, 
      c.IDDonViTinh, 
      c.DonGiaNhap, 
      c.SoLuongTon, 
      c.GhiChu
    FROM ChiTietNhapSanPham c
    INNER JOIN PhieuNhap p ON c.IDPhieuNhap = p.IDPhieuNhap
    WHERE p.IDDoiTac = @IDDoiTacCu
  `);

    // Thêm dữ liệu mới vào bảng ChiTietNhapSanPham và lấy ID mới
    for (let item of chiTietNhapSanPhamOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const newIDDonViTinh = donViTinhMapping.find(dvt => dvt.OldID === item.IDDonViTinh)?.NewID;
      await requestInsert
        .input('IDPhieuNhap', sql.Int, phieuNhapMapping.find(p => p.OldID === item.IDPhieuNhap).NewID)
        .input('IDSanPham', sql.Int, sanPhamMapping.find(s => s.OldID === item.IDSanPham).NewID)
        .input('SoLuongNhap', sql.Float, item.SoLuongNhap)
        .input('IDDonViTinh', sql.Int, newIDDonViTinh) // Cần thêm mapping cho IDDonViTinh nếu không có
        .input('DonGiaNhap', sql.Float, item.DonGiaNhap)
        .input('SoLuongTon', sql.Float, item.SoLuongTon)
        .input('GhiChu', sql.NVarChar, item.GhiChu)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
      INSERT INTO ChiTietNhapSanPham 
        (IDPhieuNhap, IDSanPham, SoLuongNhap, IDDonViTinh, DonGiaNhap, SoLuongTon, GhiChu, IDDoiTac)
      VALUES 
        (@IDPhieuNhap, @IDSanPham, @SoLuongNhap, @IDDonViTinh, @DonGiaNhap, @SoLuongTon, @GhiChu, @IDDoiTac)
    `);
    }
    console.log('chi tiết nhập sản phẩm');
    //#endregion

    //#region ChiTietNhapNguyenLieu
    request = new sql.Request(transaction); // Tạo request mới
    const chiTietNhapNguyenLieuOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT IDPhieuNhap, IDNguyenLieu, SoLuongNhap, IDDonViTinh, DonGiaNhap, SoLuongTon, GhiChu
        FROM ChiTietNhapNguyenLieu
        WHERE IDDoiTac = @IDDoiTacCu
      `);

    const chiTietNhapNguyenLieuMapping = chiTietNhapNguyenLieuOld.recordset.map(row => {
      return {
        IDPhieuNhap: phieuNhapMapping.find(pn => pn.OldID === row.IDPhieuNhap).NewID,
        IDNguyenLieu: nguyenLieuMapping.find(nl => nl.OldID === row.IDNguyenLieu).NewID,
        SoLuongNhap: row.SoLuongNhap,
        IDDonViTinh: row.IDDonViTinh, // Không cần mapping
        DonGiaNhap: row.DonGiaNhap,
        SoLuongTon: row.SoLuongTon,
        GhiChu: row.GhiChu,
        IDDoiTac: IDDoiTac
      };
    });

    // Thêm dữ liệu mới vào bảng ChiTietNhapNguyenLieu
    for (let row of chiTietNhapNguyenLieuMapping) {
      let requestInsert = new sql.Request(transaction);
      const newIDDonViTinh = donViTinhMapping.find(dvt => dvt.OldID === row.IDDonViTinh)?.NewID;

      await requestInsert
        .input('IDPhieuNhap', sql.Int, row.IDPhieuNhap)
        .input('IDNguyenLieu', sql.Int, row.IDNguyenLieu)
        .input('SoLuongNhap', sql.Float, row.SoLuongNhap)
        .input('IDDonViTinh', sql.Int, newIDDonViTinh)
        .input('DonGiaNhap', sql.Float, row.DonGiaNhap)
        .input('SoLuongTon', sql.Float, row.SoLuongTon)
        .input('GhiChu', sql.NVarChar, row.GhiChu)
        .input('IDDoiTac', sql.UniqueIdentifier, row.IDDoiTac)
        .query(`
          INSERT INTO ChiTietNhapNguyenLieu 
            (IDPhieuNhap, IDNguyenLieu, SoLuongNhap, IDDonViTinh, DonGiaNhap, SoLuongTon, GhiChu, IDDoiTac)
          VALUES 
            (@IDPhieuNhap, @IDNguyenLieu, @SoLuongNhap, @IDDonViTinh, @DonGiaNhap, @SoLuongTon, @GhiChu, @IDDoiTac)
        `);
    }
    console.log('chi tiết nhập nguyên liệu');
    //#endregion

    //#region vai trò
    request = new sql.Request(transaction); // Tạo request mới
    let vaiTroMapping = [];

    // Lấy danh sách vai trò cũ, bỏ qua IDVaiTro = 1
    const vaiTroOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT * FROM VaiTro
        WHERE IDDoiTac = @IDDoiTacCu
        AND IDVaiTro <> 1;
      `);

    // Thêm dữ liệu mới vào bảng VaiTro và lấy ID mới
    for (let vt of vaiTroOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const result = await requestInsert
        .input('TenVaiTro', sql.NVarChar, vt.TenVaiTro)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
          INSERT INTO VaiTro (TenVaiTro, IDDoiTac)
          VALUES (@TenVaiTro, @IDDoiTac);
          SELECT SCOPE_IDENTITY() AS NewID;
        `);

      // Thêm ánh xạ ID vào mảng
      vaiTroMapping.push({ OldID: vt.IDVaiTro, NewID: result.recordset[0].NewID });
    }
    console.log('vai trò');
    //#endregion

    //#region QuyenVaiTro
    request = new sql.Request(transaction); // Tạo request mới

    // Lấy dữ liệu từ bảng QuyenVaiTro cũ
    const quyenVaiTroOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
    SELECT oldRoles.IDVaiTro AS OldIDVaiTro, oldQuyen.IDQuyen
    FROM VaiTro AS oldRoles
    JOIN QuyenVaiTro AS oldQuyen ON oldRoles.IDVaiTro = oldQuyen.IDVaiTro
    WHERE oldRoles.IDDoiTac = @IDDoiTacCu
      AND oldRoles.IDVaiTro <> 1
  `);

    // Mapping dữ liệu mới
    const quyenVaiTroMapping = quyenVaiTroOld.recordset.map(row => {
      return {
        IDVaiTro: vaiTroMapping.find(vt => vt.OldID === row.OldIDVaiTro).NewID,
        IDQuyen: row.IDQuyen,
      };
    });

    // Thêm dữ liệu mới vào bảng QuyenVaiTro
    for (let row of quyenVaiTroMapping) {
      let requestInsert = new sql.Request(transaction);
      await requestInsert
        .input('IDVaiTro', sql.Int, row.IDVaiTro)
        .input('IDQuyen', sql.Int, row.IDQuyen)
        .query(`
      INSERT INTO QuyenVaiTro (IDVaiTro, IDQuyen)
      VALUES (@IDVaiTro, @IDQuyen)
    `);
    }
    console.log('Thêm xong bảng QuyenVaiTro');
    //#endregion


    //#region ca làm việc
    request = new sql.Request(transaction); // Tạo request mới
    let caLamViecMapping = [];

    // Lấy danh sách ca làm việc cũ
    const caLamViecOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT * FROM CaLamViec
        WHERE IDDoiTac = @IDDoiTacCu;
      `);

    // Thêm dữ liệu mới vào bảng CaLamViec và lấy ID mới
    for (let clv of caLamViecOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const result = await requestInsert
        .input('TenCaLamViec', sql.NVarChar, clv.TenCaLamViec)
        .input('GioBatDau', sql.VarChar, clv.GioBatDau)
        .input('GioKetThuc', sql.VarChar, clv.GioKetThuc)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
          INSERT INTO CaLamViec (TenCaLamViec, GioBatDau, GioKetThuc, IDDoiTac)
          VALUES (@TenCaLamViec, @GioBatDau, @GioKetThuc, @IDDoiTac);
          SELECT SCOPE_IDENTITY() AS NewID;
        `);

      // Thêm ánh xạ ID vào mảng
      caLamViecMapping.push({ OldID: clv.IDCaLamViec, NewID: result.recordset[0].NewID });
    }
    console.log('ca làm việc');
    //#endregion

    //#region ChotCa
    request = new sql.Request(transaction); // Tạo request mới
    const chotCaOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT IDCaLamViec, IDNhanVien, NgayLamViec, TienDauCa, TienChotCa, XacNhanNhanCa, XacNhanGiaoCa, GhiChu
        FROM ChotCa
        WHERE IDDoiTac = @IDDoiTacCu
      `);

    const chotCaMapping = chotCaOld.recordset.map(row => {
      return {
        IDCaLamViec: caLamViecMapping.find(cv => cv.OldID === row.IDCaLamViec).NewID,
        IDNhanVien: nhanVienMapping.find(nv => nv.OldID === row.IDNhanVien).NewID,
        NgayLamViec: row.NgayLamViec,
        TienDauCa: row.TienDauCa,
        TienChotCa: row.TienChotCa,
        XacNhanNhanCa: row.XacNhanNhanCa,
        XacNhanGiaoCa: row.XacNhanGiaoCa,
        GhiChu: row.GhiChu,
        IDDoiTac: IDDoiTac
      };
    });

    // Thêm dữ liệu mới vào bảng ChotCa
    for (let row of chotCaMapping) {
      let requestInsert = new sql.Request(transaction);

      await requestInsert
        .input('IDCaLamViec', sql.Int, row.IDCaLamViec)
        .input('IDNhanVien', sql.Int, row.IDNhanVien)
        .input('NgayLamViec', sql.DateTime, row.NgayLamViec)
        .input('TienDauCa', sql.Float, row.TienDauCa)
        .input('TienChotCa', sql.Float, row.TienChotCa)
        .input('XacNhanNhanCa', sql.Bit, row.XacNhanNhanCa)
        .input('XacNhanGiaoCa', sql.Bit, row.XacNhanGiaoCa)
        .input('GhiChu', sql.NVarChar, row.GhiChu)
        .input('IDDoiTac', sql.UniqueIdentifier, row.IDDoiTac)
        .query(`
          INSERT INTO ChotCa 
            (IDCaLamViec, IDNhanVien, NgayLamViec, TienDauCa, TienChotCa, XacNhanNhanCa, XacNhanGiaoCa, GhiChu, IDDoiTac)
          VALUES 
            (@IDCaLamViec, @IDNhanVien, @NgayLamViec, @TienDauCa, @TienChotCa, @XacNhanNhanCa, @XacNhanGiaoCa, @GhiChu, @IDDoiTac)
        `);
    }
    console.log('chốt ca');
    //#endregion

    //#region VaiTroNhanVien
    request = new sql.Request(transaction); // Tạo request mới
    for (let nvMapping of nhanVienMapping) {
      for (let vtMapping of vaiTroMapping) {
        let requestInsert = new sql.Request(transaction);
        await requestInsert
          .input('IDNhanVien', sql.Int, nvMapping.NewID)
          .input('IDVaiTro', sql.Int, vtMapping.NewID)
          .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
          .query(`
            INSERT INTO VaiTroNhanVien (IDNhanVien, IDVaiTro, IDDoiTac)
            VALUES (@IDNhanVien,@IDVaiTro,@IDDoiTac)
          `);
      }
    }
    console.log('vai trò nhân viên');
    //#endregion

    //#region ChiTietHoaDon
    request = new sql.Request(transaction); // Tạo request mới
    const chiTietHoaDonOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
      SELECT IDHoaDon, IDSanPham, IDTrangThai, SoLuong, ThanhTien, GhiChu, ThoiGianDat, SoLuongTang
      FROM ChiTietHoaDon
      WHERE IDDoiTac = @IDDoiTacCu
    `);

    const chiTietHoaDonMapping = chiTietHoaDonOld.recordset.map(row => {
      return {
        IDHoaDon: hoaDonMapping.find(hd => hd.OldID === row.IDHoaDon).NewID,
        IDSanPham: sanPhamMapping.find(sp => sp.OldID === row.IDSanPham).NewID,
        IDTrangThai: row.IDTrangThai,
        SoLuong: row.SoLuong,
        ThanhTien: row.ThanhTien,
        GhiChu: row.GhiChu,
        ThoiGianDat: row.ThoiGianDat,
        SoLuongTang: row.SoLuongTang,
        IDDoiTac: IDDoiTac
      };
    });

    // Thêm dữ liệu mới vào bảng ChiTietHoaDon
    for (let row of chiTietHoaDonMapping) {
      let requestInsert = new sql.Request(transaction);
      await requestInsert
        .input('IDHoaDon', sql.Int, row.IDHoaDon)
        .input('IDSanPham', sql.Int, row.IDSanPham)
        .input('IDTrangThai', sql.Int, row.IDTrangThai)
        .input('SoLuong', sql.Int, row.SoLuong)
        .input('ThanhTien', sql.Float, row.ThanhTien)
        .input('GhiChu', sql.NVarChar, row.GhiChu)
        .input('ThoiGianDat', sql.VarChar, row.ThoiGianDat)
        .input('SoLuongTang', sql.Int, row.SoLuongTang)
        .input('IDDoiTac', sql.UniqueIdentifier, row.IDDoiTac)
        .query(`
        INSERT INTO ChiTietHoaDon 
          (IDHoaDon, IDSanPham, IDTrangThai, SoLuong, ThanhTien, GhiChu, ThoiGianDat, SoLuongTang, IDDoiTac)
        VALUES 
          (@IDHoaDon, @IDSanPham, @IDTrangThai, @SoLuong, @ThanhTien, @GhiChu, @ThoiGianDat, @SoLuongTang, @IDDoiTac)
      `);
    }
    console.log('chi tiết hoá đơn');
    //#endregion

    //#region BangGia
    request = new sql.Request(transaction); // Tạo request mới
    const bangGiaOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT IDSanPham, GiaBan, NgayApDung, TrangThaiApDung
        FROM BangGia
        WHERE IDDoiTac = @IDDoiTacCu
      `);

    // Tạo mapping cho BangGia
    const bangGiaMapping = bangGiaOld.recordset.map(row => {
      return {
        IDSanPham: sanPhamMapping.find(sp => sp.OldID === row.IDSanPham).NewID,
        IDDoiTac: IDDoiTac,
        GiaBan: row.GiaBan,
        NgayApDung: row.NgayApDung,
        TrangThaiApDung: row.TrangThaiApDung
      };
    });

    // Thêm dữ liệu mới vào bảng BangGia
    for (let row of bangGiaMapping) {
      let requestInsert = new sql.Request(transaction);
      await requestInsert
        .input('IDSanPham', sql.Int, row.IDSanPham)
        .input('IDDoiTac', sql.UniqueIdentifier, row.IDDoiTac)
        .input('GiaBan', sql.Float, row.GiaBan)
        .input('NgayApDung', sql.DateTime, row.NgayApDung)
        .input('TrangThaiApDung', sql.Bit, row.TrangThaiApDung)
        .query(`
          INSERT INTO BangGia 
            (IDSanPham, IDDoiTac, GiaBan, NgayApDung, TrangThaiApDung)
          VALUES 
            (@IDSanPham, @IDDoiTac, @GiaBan, @NgayApDung, @TrangThaiApDung)
        `);
    }
    console.log('bảng giá');
    //#endregion

    //#region Loại sản phẩm
    request = new sql.Request(transaction); // Tạo request mới
    let loaiSanPhamMapping = [];

    // Lấy danh sách loại sản phẩm cũ
    const loaiSanPhamOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT * FROM LoaiSanPham
        WHERE IDDoiTac = @IDDoiTacCu;
      `);

    // Thêm dữ liệu mới vào bảng LoaiSanPham và lấy ID mới
    for (let lsp of loaiSanPhamOld.recordset) {
      let requestInsert = new sql.Request(transaction);
      const result = await requestInsert
        .input('TenLoaiSanPham', sql.NVarChar, lsp.TenLoaiSanPham)
        .input('GhiChu', sql.NVarChar, lsp.GhiChu)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
          INSERT INTO LoaiSanPham (TenLoaiSanPham, GhiChu, IDDoiTac)
          VALUES (@TenLoaiSanPham, @GhiChu, @IDDoiTac);
          SELECT SCOPE_IDENTITY() AS NewID;
        `);

      // Thêm ánh xạ ID vào mảng
      loaiSanPhamMapping.push({ OldID: lsp.IDLoaiSanPham, NewID: result.recordset[0].NewID });
    }
    console.log('loại sản phẩm');
    //#endregion

    //#region PhanLoaiSanPham
    request = new sql.Request(transaction); // Tạo request mới
    for (let nvMapping of sanPhamMapping) {
      for (let vtMapping of loaiSanPhamMapping) {
        let requestInsert = new sql.Request(transaction);
        await requestInsert
          .input('IDSanPham', sql.Int, nvMapping.NewID)
          .input('IDLoaiSanPham', sql.Int, vtMapping.NewID)
          .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
          .query(`
            INSERT INTO PhanLoaiSanPham (IDSanPham, IDLoaiSanPham, IDDoiTac)
            VALUES (@IDSanPham,@IDLoaiSanPham,@IDDoiTac)
          `);
      }
    }
    console.log('phân loại sản phẩm');
    //#endregion

    //#region ChuyenDoiDonViTinh
    request = new sql.Request(transaction); // Tạo request mới
    const chuyenDoiOld = await request
      .input('IDDoiTacCu', sql.UniqueIdentifier, IDDoiTacCu)
      .query(`
        SELECT IDDonViCu, IDDonViMoi, HeSoChuyenDoi
        FROM ChuyenDoiDonViTinh
        WHERE IDDoiTac = @IDDoiTacCu
      `);

    // Tạo mapping cho ChuyenDoiDonViTinh
    const chuyenDoiMapping = chuyenDoiOld.recordset.map(row => {
      return {
        IDDonViCu: donViTinhMapping.find(dv => dv.OldID === row.IDDonViCu).NewID,
        IDDonViMoi: donViTinhMapping.find(dv => dv.OldID === row.IDDonViMoi).NewID,
        IDDoiTac: IDDoiTac,
        HeSoChuyenDoi: row.HeSoChuyenDoi
      };
    });

    // Thêm dữ liệu mới vào bảng ChuyenDoiDonViTinh
    for (let row of chuyenDoiMapping) {
      let requestInsert = new sql.Request(transaction);
      await requestInsert
        .input('IDDonViCu', sql.Int, row.IDDonViCu)
        .input('IDDonViMoi', sql.Int, row.IDDonViMoi)
        .input('IDDoiTac', sql.UniqueIdentifier, row.IDDoiTac)
        .input('HeSoChuyenDoi', sql.Float, row.HeSoChuyenDoi)
        .query(`
          INSERT INTO ChuyenDoiDonViTinh 
            (IDDonViCu, IDDonViMoi, IDDoiTac, HeSoChuyenDoi)
          VALUES 
            (@IDDonViCu, @IDDonViMoi, @IDDoiTac, @HeSoChuyenDoi)
        `);
    }
    console.log('chuyểnn đổi đơn vị tính');
    //#endregion


  } catch (error) {
    console.log("lỗi hàm addSampleData: ", error);

    throw error;
  }
}

//xử lý tải sử dụng dữ liệu mẫu
async function getUseSampleData(IDDoiTac) {
  try {
    const result = await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('loginAndPermission_getUseSampleData');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Cập nhật sử dụng dữ liệu mẫu
async function updateUseSampleData(IDDoiTac, SuDungDuLieuMau) {
  try {
    //kiểm tra xem dữ liệu mẫu có được sử dụng chưa
    const result = await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('loginAndPermission_getUseSampleData');
    if (result.recordset[0]["SuDungDuLieuMau"] === true && SuDungDuLieuMau === true) {
      return true
    }
    else if (result.recordset[0]["SuDungDuLieuMau"] === false && SuDungDuLieuMau === false) {
      return true
    } else {
      // Bắt đầu một transaction
      const transaction = new sql.Transaction(pool);
      try {
        // Bắt đầu transaction
        await transaction.begin();
        // Tạo một request trong transaction
        const request = new sql.Request(transaction);

        //cập nhật dữ liệu trong bảng đối tác cột SuDungDuLieuMau
        await request
          .input('SuDungDuLieuMau', sql.Int, SuDungDuLieuMau)
          .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
          .execute('loginAndPermission_updateUseSampleData');
        if (SuDungDuLieuMau) { // nếu có dữ liệu mẫu
          await addSampleData(transaction, '4a7666cf-0da4-4f4b-b546-b0e67c1e4c08', IDDoiTac)
        } else { // nếu không có dữ liệu mẫu, xoá các dữ liệu hiện tại
          resetDataByIDDoiTac(IDDoiTac)
        }
        // Nếu không có lỗi, commit transaction
        await transaction.commit();
        return true
      } catch (err) {
        // Nếu có lỗi, rollback transaction
        console.log('err', err);

        await transaction.rollback();
        return false
      }
    }
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
  resetDataByIDDoiTac: resetDataByIDDoiTac,
  getUseSampleData: getUseSampleData,
  updateUseSampleData: updateUseSampleData
};
