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

/*  Quản lý hoá đơn */
//xử lý tải danh sách hoá đơn
async function getInvoice() {
  try {
    let result = await pool.request().query('EXEC invoice_getInvoice_getInvoice');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá hoá đơn
async function deleteInvoice(ID) {
  try {
    await pool.request()
      .input('IDDonViTinh', sql.Int, ID)
      .execute('inventory_deleteInvoice_deleteInvoice');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm hoá đơn
async function insertInvoice(data) {
  try {
    await pool.request()
      .input('TenDonViTinh', sql.NVarChar, data.TenDonViTinh)
      .execute('inventory_insertInvoice_insertInvoice');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật hoá đơn
async function updateInvoice(data) {
  try {
    await pool.request()
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .input('TenDonViTinh', sql.NVarChar, data.TenDonViTinh)
      .execute('inventory_updateInvoice_updateInvoice');
    return { success: true };
  } catch (error) {
    throw error;
  }
}



module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getInvoice: getInvoice,
  deleteInvoice: deleteInvoice,
  insertInvoice: insertInvoice,
  updateInvoice: updateInvoice
};