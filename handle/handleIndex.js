const db = require('../dbconfig');
const pool = db.getPool();
const sql = require('mssql');
const { format } = require('date-fns'); //ép định dạng cho ngày tháng năm
const bcrypt = require('bcrypt'); // dùng để mã hoá mật khẩu và tạo mã phiên đăng nhập

//Kiểm tra phiên và quyền đăng nhập
async function checkSessionAndRole(ss, permission) {
  try {
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');

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
        const permissions = resultVaiTro.recordset.map((row) => row.TenQuyen);;
        for (const p of permissions) {
          if (p === permission) {
            console.log('Có quyền truy cập');
            return true; // Nếu tìm thấy quyền khớp với biến permission, trả về true
          }
        }
        console.log('Không có quyền truy cập');
        return false; // Nếu không tìm thấy quyền nào khớp với biến permission, trả về false
      }
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra phiên và vai trò:", error);
    throw error;
  }
}

//hàm đăng nhập
async function login(data) {
  try {
    console.log(data.TaiKhoan);
    let res = await pool.request()
      .input('TaiKhoan', sql.VarChar, data.TaiKhoan)
      .query('EXEC loginAndPermission_login_getListUsers @TaiKhoan');
    if (res !== undefined && res.recordset.length > 0) {
      let matchedUser;
      for (const user of res.recordset) {
        const isPasswordMatch = await bcrypt.compare(data.MatKhau, user.MatKhau);
        if (isPasswordMatch) {
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
            cookieValue: MaDangNhap
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
          message: "Tài khoản hoặc mật khẩu không chính xác!",
        };
      }
    } else {
      // Người dùng không tồn tại
      return {
        success: false,
        message: "Tài khoản hoặc mật khẩu không chính xác!",
      };
    }
  } catch (error) {
    throw error;
  }
}

//hàm kiểm tra phiên đăng nhập
async function session(MaDangNhap) {
  try {//kiểm tra thông tin đăng nhập từ mã đăng nhập
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, MaDangNhap.ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');
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
              listShiftsNotClosed: resultChotCa.recordset
            }
          else return {
            success: true,
            NhanVien: result.recordset[0],
            menu: menu,
            ChotCa: true
          };
        }
        else return { success: true, NhanVien: result.recordset[0], menu: menu };
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

//xử lý tải dữ liệu tài khoản
async function getAccount() {
  try {
    let result = await pool.request().query('EXEC employee_getAccount_getAccount');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//xử lý thêm dữ liệu tài khoản
async function insertAccount(data) {
  try {
    const hashedPassword = typeof data.MatKhau === 'undefined' ? null : await bcrypt.hash(data.MatKhau, 10);
    var IDVaiTro = data.IDVaiTro
    var TaiKhoan = data.TaiKhoan
    if (typeof data.IDVaiTro === 'undefined') {
      IDVaiTro = null
      TaiKhoan = null
    }

    const result = await pool.request()
      .input('TenNhanVien', sql.NVarChar, data.TenNhanVien)
      .input('IDViTriCongViec', sql.Int, data.IDViTriCongViec)
      .input('TaiKhoan', sql.VarChar, TaiKhoan)
      .input('MatKhau', sql.NVarChar, hashedPassword)
      .input('NgaySinh', sql.Date, data.NgaySinh)
      .input('GioiTinh', sql.NVarChar, data.GioiTinh)
      .input('DiaChi', sql.NVarChar, data.DiaChi)
      .input('SoDienThoai', sql.Int, data.SoDienThoai)
      .input('TinhTrang', sql.NVarChar, data.TinhTrang)
      .input('NgayVao', sql.Date, data.NgayVao)
      .input('IDVaiTro', sql.NVarChar, IDVaiTro)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .execute('employee_insertAccount_insertAccount');

    return { success: true, message: "Thêm Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}

//xử lý sửa tài khoản
async function updateAccount(data) {
  try {
    console.log(data);
    var hashedPassword = null
    if (typeof data.MatKhau === 'undefined' || data.MatKhau === '')
      hashedPassword = null
    else hashedPassword = await bcrypt.hash(data.MatKhau, 10)
    // var hashedPassword = typeof data.MatKhau === 'undefined' ? null : await bcrypt.hash(data.MatKhau, 10);
    // hashedPassword = data.MatKhau === '' ? null : await bcrypt.hash(data.MatKhau, 10);
    var IDVaiTro = data.IDVaiTro
    var TaiKhoan = data.TaiKhoan
    if (typeof data.IDVaiTro === 'undefined' || data.IDVaiTro.length === 0) {
      IDVaiTro = null
      TaiKhoan = null
    }

    const result = await pool.request()
      .input('IDNhanVien', sql.Int, data.IDNhanVien)
      .input('TenNhanVien', sql.NVarChar, data.TenNhanVien)
      .input('IDViTriCongViec', sql.Int, data.IDViTriCongViec)
      .input('TaiKhoan', sql.VarChar, TaiKhoan)
      .input('MatKhau', sql.NVarChar, hashedPassword)
      .input('NgaySinh', sql.Date, data.NgaySinh)
      .input('GioiTinh', sql.NVarChar, data.GioiTinh)
      .input('DiaChi', sql.NVarChar, data.DiaChi)
      .input('SoDienThoai', sql.Int, data.SoDienThoai)
      .input('TinhTrang', sql.NVarChar, data.TinhTrang)
      .input('NgayVao', sql.Date, data.NgayVao)
      .input('IDVaiTro', sql.NVarChar, IDVaiTro)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .execute('employee_updateAccount_updateAccount');

    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}


//Xử lý tìm kiếm tài khoản: 
async function searchAccount(search, searchBy) {
  try {
    let result = await pool.request()
      .input('search', sql.NVarChar, search)
      .input('searchBy', sql.NVarChar, searchBy)
      .query('EXEC employee_searchAccount_searchAccount @search, @searchBy');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}


//xử lý lấy danh sách vai trò theo id
async function getListRoleByIDAccount(ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('employee_getAccount_getListRoleByIDAccount');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}


//Hàm xoá tài khoản
async function deleteAccount(ID) {
  try {
    const result = await pool.request()
      .input('IDNhanVien', sql.Int, ID)
      .execute('employee_deleteAccount_deleteAccount');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}

//Hàm khôi phục dữ liệu đã xoá
async function undoDeleteAccount(ID) {
  try {
    let res = await pool.request()
      .input('IDNhanVien', sql.Int, ID)
      .execute('employee_undoDeleteAccount_undoDeleteAccount');
  } catch (error) {
    throw error;
  }
}









//xử lý tải danh sách vai trò
async function getRole() {
  try {
    let result = await pool.request().query('EXEC employee_getRole_getRole');
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
async function insertRole(data) {
  try {
    const result = await pool.request()
      .input('TenVaiTro', sql.NVarChar, data.TenVaiTro)
      .input('IDQuyen', sql.NVarChar, data.IDQuyen)
      .execute('employee_insertRole_insertRole');
    return { success: true, message: "Thêm Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}

//xử lý sửa vai trò truy cập
async function updateRole(data) {
  try {
    const result = await pool.request()
      .input('IDVaiTro', sql.Int, data.IDVaiTro)
      .input('TenVaiTro', sql.NVarChar, data.TenVaiTro)
      .input('IDQuyen', sql.NVarChar, data.IDQuyen)
      .execute('employee_updateRole_updateRole');
    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
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
//Hàm xoá vai trò truy cập
async function deleteRole(ID) {
  try {
    const result = await pool.request()
      .input('IDVaiTro', sql.Int, ID)
      .execute('employee_deleteRole_deleteRole');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}




//xử lý tải danh sách vị trí công việc
async function getJobPosition() {
  try {
    let result = await pool.request().query('EXEC employee_getJobPosition_getJobPosition');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//Hàm xoá vai trò truy cập
async function deleteJobPosition(ID) {
  try {
    console.log('ID', ID);
    const result = await pool.request()
      .input('IDViTriCongViec', sql.Int, ID)
      .execute('employee_deleteJobPosition_deleteJobPosition');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}

//xử lý thêm vị trí công việc
async function insertJobPosition(data) {
  try {
    let MoTa = null;
    if (typeof data.MoTa === 'undefined')
      MoTa = null;
    else MoTa = data.MoTa;
    await pool.request()
      .input('TenViTriCongViec', sql.NVarChar, data.TenViTriCongViec)
      .input('MoTa', sql.NVarChar, MoTa)
      .execute('employee_insertJobPosition_insertJobPosition');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật vị trí công việc
async function updateJobPosition(data) {
  try {
    let MoTa = null;
    if (typeof data.MoTa === 'undefined')
      MoTa = null;
    else MoTa = data.MoTa;
    await pool.request()
      .input('IDViTriCongViec', sql.Int, data.IDViTriCongViec)
      .input('TenViTriCongViec', sql.NVarChar, data.TenViTriCongViec)
      .input('MoTa', sql.NVarChar, MoTa)
      .execute('employee_updateJobPosition_updateJobPosition');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
//hàm đổi mật khẩu
async function changePassword(ss, MatKhauCu, MatKhauMoi) {
  try {//kiểm tra thông tin đăng nhập từ mã đăng nhập
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');
      
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




module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  login: login,
  session: session,
  logout: logout,
  getAccount: getAccount,
  searchAccount: searchAccount,
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

  getDataSelected: getDataSelected,

};
