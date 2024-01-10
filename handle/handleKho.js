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

/*  Quản lý Đơn vị tính */
//xử lý tải danh sách đơn vị tính
async function getUnit() {
  try {
    let result = await pool.request().query('EXEC inventory_getUnit_getUnit');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá đơn vị tính
async function deleteUnit(ID) {
  try {
    await pool.request()
      .input('IDDonViTinh', sql.Int, ID)
      .execute('inventory_deleteUnit_deleteUnit');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm đơn vị tính
async function insertUnit(data) {
  try {
    await pool.request()
      .input('TenDonViTinh', sql.NVarChar, data.TenDonViTinh)
      .execute('inventory_insertUnit_insertUnit');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật đơn vị tính
async function updateUnit(data) {
  try {
    await pool.request()
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .input('TenDonViTinh', sql.NVarChar, data.TenDonViTinh)
      .execute('inventory_updateUnit_updateUnit');
    return { success: true };
  } catch (error) {
    throw error;
  }
}



/*  Quản lý Phiếu nhập */
//xử lý tải danh sách Phiếu nhập
async function getReceipt() {
  try {
    let result = await pool.request().query('EXEC inventory_getReceipt_getReceipt');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//Tải 1 phiếu nhập: Lấy danh sách nguyên liệu theo IDPhieuNhap
async function getListIngredientByIDReceipt(ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('inventory_getReceipt_getListIngredientByIDReceipt');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Tải 1 phiếu nhập: Lấy danh sách sản phẩm theo IDPhieuNhap
async function getListProductByIDReceipt(ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('inventory_getReceipt_getListProductByIDReceipt');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá phiếu nhập
async function deleteReceipt(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .input('NameTable', sql.VarChar, 'PhieuNhap')
      .execute('global_deleteRowTable');
  } catch (error) {
    throw error;
  }
}


//xử lý lấy danh sách nguyên liệu
async function getIngredient() {
  try {
    let result = await pool.request().query('EXEC inventory_getIngredient_getIngredient');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}


module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getUnit: getUnit,
  deleteUnit: deleteUnit,
  insertUnit:insertUnit,
  updateUnit:updateUnit,
  getReceipt:getReceipt,
  deleteReceipt:deleteReceipt,
  getListIngredientByIDReceipt:getListIngredientByIDReceipt,
  getListProductByIDReceipt:getListProductByIDReceipt,
  getIngredient:getIngredient
};