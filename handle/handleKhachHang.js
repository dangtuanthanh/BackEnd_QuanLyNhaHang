const db = require('../dbconfig');
const pool = db.getPool();
const sql = require('mssql');
//Kiểm tra phiên và quyền đăng nhập
async function checkSessionAndRole(ss, permission) {
  try {
    const NgayHomNay = new Date();
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .input('NgayHomNay', sql.DateTime,NgayHomNay)
      .execute('loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap');
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
//xử lý tải danh sách khách hàng
async function getCustomer(IDDoiTac) {
  try {
    let result = await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
    .execute('customer_getCustomer_getCustomer');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá khách hàng
async function deleteCustomer(IDDoiTac,ID) {
  try {
    await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('IDKhachHang', sql.Int, ID)
      .execute('customer_deleteCustomer_deleteCustomer');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm khách hàng
async function insertCustomer(IDDoiTac,data) {
  try {
    await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('TenKhachHang', sql.NVarChar, data.TenKhachHang)
      .input('SoDienThoai', sql.VarChar, data.SoDienThoai)
      .execute('customer_insertCustomer_insertCustomer');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật khách hàng
async function updateCustomer(IDDoiTac,data) {
  try {
    await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
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
  getIDDoiTac:getIDDoiTac,
  getCustomer: getCustomer,
  deleteCustomer: deleteCustomer,
  insertCustomer:insertCustomer,
  updateCustomer:updateCustomer
};