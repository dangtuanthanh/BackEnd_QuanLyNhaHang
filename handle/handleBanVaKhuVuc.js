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
async function getArea() {
  try {
    let result = await pool.request().query('EXEC tableAndArea_getArea_getArea');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá khu vực
async function deleteArea(ID) {
  try {
    await pool.request()
      .input('IDKhuVuc', sql.Int, ID)
      .execute('tableAndArea_deleteArea_deleteArea');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm khu vực
async function insertArea(data) {
  try {
    await pool.request()
      .input('TenKhuVuc', sql.NVarChar, data.TenKhuVuc)
      .execute('tableAndArea_insertArea_insertArea');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật khu vực
async function updateArea(data) {
  try {
    await pool.request()
      .input('IDKhuVuc', sql.Int, data.IDKhuVuc)
      .input('TenKhuVuc', sql.NVarChar, data.TenKhuVuc)
      .execute('tableAndArea_updateArea_updateArea');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý tải danh sách bàn
async function getTable() {
  try {
    let result = await pool.request().query('EXEC tableAndArea_getTable_getTable');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá bàn
async function deleteTable(ID) {
  try {
    await pool.request()
      .input('IDBan', sql.Int, ID)
      .execute('tableAndArea_deleteTable_deleteTable');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm bàn
async function insertTable(data) {
  try {
    await pool.request()
      .input('TenBan', sql.NVarChar, data.TenBan)
      .input('TrangThai', sql.NVarChar, data.TrangThai)
      .input('GhiChu', sql.NVarChar, data.GhiChu)
      .input('IDKhuVuc', sql.Int, data.IDKhuVuc)
      .execute('tableAndArea_insertTable_insertTable');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật bàn
async function updateTable(data) {
  try {
    await pool.request()
      .input('IDBan', sql.Int, data.IDBan)
      .input('TenBan', sql.NVarChar, data.TenBan)
      .input('TrangThai', sql.NVarChar, data.TrangThai)
      .input('GhiChu', sql.NVarChar, data.GhiChu)
      .input('IDKhuVuc', sql.Int, data.IDKhuVuc)
      .execute('tableAndArea_updateTable_updateTable');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getArea: getArea,
  deleteArea: deleteArea,
  insertArea:insertArea,
  updateArea:updateArea,
  getTable:getTable,
  deleteTable:deleteTable,
  insertTable:insertTable,
  updateTable:updateTable,
};