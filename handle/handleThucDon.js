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

/*  Quản lý loại sản phẩm */
//xử lý tải danh sách loại sản phẩm
async function getTypeProduct() {
  try {
    let result = await pool.request().query('EXEC menu_getTypeProduct_getTypeProduct');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá loại sản phẩm
async function deleteTypeProduct(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .input('NameTable', sql.VarChar, 'LoaiSanPham')
      .execute('global_deleteRowTable');
  } catch (error) {
    console.log('error',error);
    throw error;
  }
}

//xử lý thêm loại sản phẩm
async function insertTypeProduct(data) {
  try {
    var ghiChu = null
    if (data.GhiChu || data.GhiChu !== '') {//nếu có ghi chú
      ghiChu = data.GhiChu
    }
    await pool.request()
      .input('TenLoaiSanPham', sql.NVarChar, data.TenLoaiSanPham)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .execute('menu_insertTypeProduct_insertTypeProduct');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật loại sản phẩm
async function updateTypeProduct(data) {
  try {
    var ghiChu = null
    if (data.GhiChu || data.GhiChu !== '') {//nếu có ghi chú
      ghiChu = data.GhiChu
    }
    await pool.request()
      .input('IDLoaiSanPham', sql.Int, data.IDLoaiSanPham)
      .input('TenLoaiSanPham', sql.NVarChar, data.TenLoaiSanPham)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .execute('menu_updateTypeProduct_updateTypeProduct');
    return { success: true };
  } catch (error) {
    throw error;
  }
}



/*  Quản lý sản phẩm */
// Lấy danh sách toàn bộ sản phẩm (dùng cho menu chọn món)
async function getProduct() {
  try {
    let result = await pool.request().query('EXEC menu_getProduct_getProduct');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
/*  Quản lý sản phẩm thành phẩm */
//xử lý Lấy danh sách sản phẩm thành phẩm
async function getFinishedProduct() {
  try {
    let result = await pool.request().query('EXEC menu_getFinishedProduct_getFinishedProduct');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá sản phẩm thành phẩm
async function deleteFinishedProduct(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .input('NameTable', sql.VarChar, 'SanPham')
      .execute('global_deleteRowTable');
  } catch (error) {
    throw error;
  }
}


module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getTypeProduct:getTypeProduct,
  deleteTypeProduct:deleteTypeProduct,
  insertTypeProduct:insertTypeProduct,
  updateTypeProduct:updateTypeProduct,
  getFinishedProduct: getFinishedProduct,
  deleteFinishedProduct:deleteFinishedProduct,
  getProduct:getProduct
};