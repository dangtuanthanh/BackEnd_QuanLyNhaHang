const db = require('../dbconfig');
const pool = db.getPool();
const sql = require('mssql');
//Kiểm tra phiên và quyền đăng nhập
async function checkSessionAndRole(ss, permission) {
  try {
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');
    if (result.recordset.length === 0) {
      return false;
    } else {
      const timeSession = result.recordset[0].HanDangNhap;
      const currentTime = new Date();
      if (currentTime > timeSession) {
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
            return true; // Nếu tìm thấy quyền khớp với biến permission, trả về true
          }
        }
        return false; // Nếu không tìm thấy quyền nào khớp với biến permission, trả về false
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

//xử lý tải danh sách ca làm việc
async function getShifts() {
  try {
    let result = await pool.request().query('EXEC shifts_getShifts_getShifts');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá ca làm việc
async function deleteShifts(ID) {
  try {
    await pool.request()
      .input('IDCaLamViec', sql.Int, ID)
      .execute('shifts_deleteShifts_deleteShifts');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm ca làm việc
async function insertShifts(data) {
  try {
    await pool.request()
      .input('TenCaLamViec', sql.NVarChar, data.TenCaLamViec)
      .input('GioBatDau', sql.VarChar, data.GioBatDau)
      .input('GioKetThuc', sql.VarChar, data.GioKetThuc)
      .execute('shifts_insertShifts_insertShifts');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật ca làm việc
async function updateShifts(data) {
  try {
    await pool.request()
      .input('IDCaLamViec', sql.Int, data.IDCaLamViec)
      .input('TenCaLamViec', sql.NVarChar, data.TenCaLamViec)
      .input('GioBatDau', sql.VarChar, data.GioBatDau)
      .input('GioKetThuc', sql.VarChar, data.GioKetThuc)
      .execute('shifts_updateShifts_updateShifts');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý tải danh sách chốt ca
async function getCloseShifts() {
  try {
    let result = await pool.request().query('EXEC shifts_getCloseShifts_getCloseShifts');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//xử lý tải danh sách ca phù hợp với giờ hiện tại
async function getMatchShifts() {
  try {
    //Lấy giờ hiện tại
    let currentTime = new Date();
    let hours = currentTime.getHours().toString();
    let minutes = currentTime.getMinutes().toString();
    if (hours.length < 2) hours = '0' + hours;
    if (minutes.length < 2) minutes = '0' + minutes;
    currentTime = parseInt(hours + minutes);
    //Khai báo mảng lưu kết quả
    let shiftArray = [];
    //Gọi hàm lấy danh sách ca làm việc
    let shifts = await getShifts();
    //Lặp qua từng record trong danh sách ca làm việc  
    shifts.forEach(shift => {
      //Chuyển giờ sang số để so sánh 
      let start = parseInt(shift.GioBatDau.replace(':', ''));
      let end = parseInt(shift.GioKetThuc.replace(':', ''));
      //Kiểm tra giờ hiện tại có trong khoảng thời gian ca không
      if (currentTime >= start && currentTime <= end) {
        //Nếu có, thêm vào mảng kết quả
        shiftArray.push({
          IDCaLamViec: shift.IDCaLamViec,
          TenCaLamViec: shift.TenCaLamViec + ': ' + shift.GioBatDau + ' - ' + shift.GioKetThuc
        });
      }
    });
    //In ra mảng kết quả
    return { success: true, shiftArray: shiftArray };
  } catch (error) {
    throw error;
  }
}

//xử lý thêm chốt ca mới
async function insertCloseShifts(data) {
  try {
    var ghiChu = data.GhiChu
    if (typeof data.GhiChu === 'undefined') {
      ghiChu = null
    }
    await pool.request()
      .input('IDCaLamViec', sql.Int, data.IDCaLamViec)
      .input('IDNhanVien', sql.Int, data.IDNhanVien)
      .input('NgayLamViec', sql.DateTime, data.NgayLamViec)
      .input('TienDauCa', sql.Float, data.TienDauCa)
      .input('TienChotCa', sql.Float, data.TienChotCa)
      .input('XacNhanNhanCa', sql.Bit, data.XacNhanNhanCa)
      .input('XacNhanGiaoCa', sql.Bit, data.XacNhanGiaoCa)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .execute('shifts_insertCloseShifts_insertCloseShifts');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý Cập nhật chốt ca
async function updateCloseShifts(data) {
  try {
    var ghiChu = data.GhiChu
    if (typeof data.GhiChu === 'undefined') {
      ghiChu = null
    }
    await pool.request()
      .input('IDChotCa', sql.Int, data.IDChotCa)
      .input('IDCaLamViec', sql.Int, data.IDCaLamViec)
      .input('IDNhanVien', sql.Int, data.IDNhanVien)
      .input('NgayLamViec', sql.DateTime, data.NgayLamViec)
      .input('TienDauCa', sql.Float, data.TienDauCa)
      .input('TienChotCa', sql.Float, data.TienChotCa)
      .input('XacNhanNhanCa', sql.Bit, data.XacNhanNhanCa)
      .input('XacNhanGiaoCa', sql.Bit, data.XacNhanGiaoCa)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .execute('shifts_updateCloseShifts_updateCloseShifts');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
//Hàm xoá chốt ca
async function deleteCloseShifts(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .execute('shifts_deleteCloseShifts_deleteCloseShifts');
  } catch (error) {
    throw error;
  }
}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getShifts: getShifts,
  deleteShifts: deleteShifts,
  insertShifts: insertShifts,
  updateShifts: updateShifts,
  getCloseShifts: getCloseShifts,
  getMatchShifts: getMatchShifts,
  insertCloseShifts: insertCloseShifts,
  logout: logout,
  updateCloseShifts:updateCloseShifts,
  deleteCloseShifts:deleteCloseShifts
};