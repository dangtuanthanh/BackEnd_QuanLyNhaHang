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
//xử lý tải danh sách khu vực
async function getCustomer() {
  try {
    let result = await pool.request().query('EXEC customer_getCustomer_getCustomer');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá khu vực
async function deleteCustomer(ID) {
  try {
    await pool.request()
      .input('IDKhachHang', sql.Int, ID)
      .execute('customer_deleteCustomer_deleteCustomer');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm khu vực
async function insertCustomer(data) {
  try {
    await pool.request()
      .input('TenKhachHang', sql.NVarChar, data.TenKhachHang)
      .input('SoDienThoai', sql.VarChar, data.SoDienThoai)
      .execute('customer_insertCustomer_insertCustomer');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật khu vực
async function updateCustomer(data) {
  try {
    await pool.request()
      .input('IDKhachHang', sql.Int, data.IDKhachHang)
      .input('TenKhachHang', sql.NVarChar, data.TenKhachHang)
      .input('SoDienThoai', sql.VarChar, data.SoDienThoai)
      .execute('customer_updateCustomer_updateCustomer');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getCustomer: getCustomer,
  deleteCustomer: deleteCustomer,
  insertCustomer:insertCustomer,
  updateCustomer:updateCustomer
};