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

/*  Quản lý loại sản phẩm */
//xử lý tải danh sách loại sản phẩm
async function getTypeProduct(IDDoiTac) {
  try {
    let result = await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
    .execute('menu_getTypeProduct_getTypeProduct');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá loại sản phẩm
async function deleteTypeProduct(IDDoiTac,ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .input('NameTable', sql.VarChar, 'LoaiSanPham')
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('global_deleteRowTable');
  } catch (error) {
    console.log('error', error);
    throw error;
  }
}
//xử lý thêm loại sản phẩm
async function insertTypeProduct(IDDoiTac,data) {
  try {
    var ghiChu = null
    if (data.GhiChu || data.GhiChu !== '') {//nếu có ghi chú
      ghiChu = data.GhiChu
    }
    await pool.request()
      .input('TenLoaiSanPham', sql.NVarChar, data.TenLoaiSanPham)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_insertTypeProduct_insertTypeProduct');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
//xử lý cập nhật loại sản phẩm
async function updateTypeProduct(IDDoiTac,data) {
  try {
    var ghiChu = null
    if (data.GhiChu || data.GhiChu !== '') {//nếu có ghi chú
      ghiChu = data.GhiChu
    }
    await pool.request()
      .input('IDLoaiSanPham', sql.Int, data.IDLoaiSanPham)
      .input('TenLoaiSanPham', sql.NVarChar, data.TenLoaiSanPham)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_updateTypeProduct_updateTypeProduct');
    return { success: true };
  } catch (error) {
    throw error;
  }
}



/*  Quản lý sản phẩm */
// Lấy danh sách toàn bộ sản phẩm (dùng cho menu chọn món)
async function getProduct(IDDoiTac) {
  try {
    let result = await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
    .execute('menu_getProduct_getProduct');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy danh sách loại sản phẩm theo id
async function getListTypeProductByIDProduct(IDDoiTac,ID) {
  try {
    const result = await pool.request()
      .input('ID', sql.Int, ID)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_getProduct_getListTypeProductByIDProduct');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy danh sách chi tiết định mức theo IDSanPham
async function getListNormDetailsByIDProduct(IDDoiTac,ID) {
  try {
    const result = await pool.request()
      .input('ID', sql.Int, ID)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_getProduct_getListNormDetailsByIDProduct');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy danh sách giá sản phẩm theo id
async function getListPriceProductByID(IDDoiTac,ID) {
  try {
    const result = await pool.request()
      .input('ID', sql.Int, ID)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_getProduct_getListPriceProductByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý tải danh sách sản phẩm theo loại sản phẩm
async function getProductByIDTypeProduct(IDDoiTac,ID) {
  try {
    let result = await pool.request()
    .input('IDLoaiSanPham', sql.Int, ID)
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
    .execute('menu_getProduct_getProductByIDTypeProduct');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá sản phẩm
async function deleteProduct(IDDoiTac,ID) {
  try {
    console.log('ID',ID);
console.log('IDDoiTac',IDDoiTac);
    await pool.request()
      .input('ID', sql.Int, ID)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_deleteProduct_deleteProduct');
  } catch (error) {
    throw error;
  }
}





//xử lý thêm sản phẩm thành phẩm
async function insertFinishedProduct(IDDoiTac,data) {
  try {
    //lấy ngày giờ hôm nay để thêm vào bảng giá
    const date = new Date();
    const datetime = date.toISOString();
    await pool.request()
      .input('TenSanPham', sql.NVarChar, data.TenSanPham)
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .input('IDLoaiSanPham', sql.NVarChar, data.IDLoaiSanPham)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('GiaBan', sql.Int, data.GiaBan)
      .input('NgayApDung', sql.DateTime, datetime)
      .input('SanPhamThanhPham', sql.Bit, data.SanPhamThanhPham)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_insertProduct_insertFinishedProduct');
    return { success: true, message: "Thêm Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
//xử lý cập nhật sản phẩm thành phẩm
async function updateFinishedProduct(IDDoiTac,data) {
  try {
     //lấy ngày giờ hôm nay để thêm vào bảng giá
     const date = new Date();
     const datetime = date.toISOString();
    await pool.request()
      .input('IDSanPham', sql.Int, data.IDSanPham)
      .input('TenSanPham', sql.NVarChar, data.TenSanPham)
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .input('GiaBan', sql.Float, data.GiaBan)
      .input('NgayApDung', sql.DateTime, datetime)
      .input('IDLoaiSanPham', sql.NVarChar, data.IDLoaiSanPham)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_updateProduct_updateFinishedProduct');
    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
//xử lý thêm sản phẩm chế biến
async function insertProcessedProduct(IDDoiTac,data) {
  try {
    //lấy ngày giờ hôm nay để thêm vào bảng giá
    const date = new Date();
    const datetime = date.toISOString();
    return await pool.request()
      .input('TenSanPham', sql.NVarChar, data.TenSanPham)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .input('IDLoaiSanPham', sql.NVarChar, data.IDLoaiSanPham)
      .input('GiaBan', sql.Int, data.GiaBan)
      .input('NgayApDung', sql.DateTime, datetime)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('SanPhamThanhPham', sql.Bit, data.SanPhamThanhPham)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_insertProduct_insertProcessedProduct')
      .then(result => {
        const IDSanPham = result.recordset[0][''];
        const danhSachObj = JSON.parse(data.DanhSach);
        return danhSachObj.reduce((p, item) => {
          return p.then(_ => {
            return insertNormDetails(IDDoiTac,IDSanPham, item);
          });
        }, Promise.resolve());
      })
  } catch (error) {
    throw error;
  }
}
//thêm chi tiết định mức vào bảng chi tiết định mức( sản phẩm chế biến)
function insertNormDetails(IDDoiTac,IDSanPham, item) {
  return pool.request()
    .input('IDSanPham', sql.Int, IDSanPham)
    .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
    .input('KhoiLuong', sql.Float, item.KhoiLuong)
    .input('IDDonViTinh', sql.Int, item.IDDonViTinh)
    .input('TiLeSai', sql.Float, item.TiLeSai)
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
    .execute('menu_insertProduct_insertNormDetails')
    .then(result => {
      return result;
    });
}
//xử lý cập nhật sản phẩm chế biến
async function updateProcessedProduct(IDDoiTac,data) {
  try {
    //lấy ngày giờ hôm nay để thêm vào bảng giá
    const date = new Date();
    const datetime = date.toISOString();
    await pool.request()
      .input('IDSanPham', sql.Int, data.IDSanPham)
      .input('TenSanPham', sql.NVarChar, data.TenSanPham)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .input('GiaBan', sql.Float, data.GiaBan)
      .input('NgayApDung', sql.DateTime, datetime)
      .input('IDLoaiSanPham', sql.NVarChar, data.IDLoaiSanPham)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_updateProduct_updateProcessedProduct');
    const danhSachObj = JSON.parse(data.DanhSach);
    const result = await Promise.all(
      danhSachObj.map(async (item) => {
        // Gọi sp lấy chi tiết định mức cũ có IDPhieuNhap, IDNguyenLieu
        const oldDetail = await getNormDetailsByID(IDDoiTac,data.IDSanPham, item.IDNguyenLieu)
        if (oldDetail.length > 0)
          // Có thì cập nhật
          await updateNormDetails(IDDoiTac,data.IDSanPham, item)
        else
          // Không có thì thêm
          await insertNormDetails(IDDoiTac,data.IDSanPham, item)
      })
    );

    // Kiểm tra danh sách người dùng truyền vào
    const newList = await getListNormDetailsByIDProduct(IDDoiTac,data.IDSanPham)
    // Xoá các hàng dữ liệu không có trong danh sách người dùng truyền vào
    const idField = 'IDNguyenLieu'
    const deleteList = newList.filter(item =>
      !danhSachObj.find(detail =>
        detail[idField] === item[idField]
      )
    );

    // Xóa các item trong deleteList
    for (const item of deleteList) {
      await deleteNormDetails(IDDoiTac,data.IDSanPham, item.IDNguyenLieu)
    }

    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
// lấy chi tiết định mức theo ID
async function getNormDetailsByID(IDDoiTac,IDSanPham, IDNguyenLieu) {
  try {
    let result = await pool.request()
      .input('IDSanPham', sql.Int, IDSanPham)
      .input('IDNguyenLieu', sql.Int, IDNguyenLieu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_updateProduct_getNormDetailsByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//hàm cập nhật chi tiết định mức
async function updateNormDetails(IDDoiTac,IDSanPham, item) {
  try {
    await pool.request()
      .input('IDSanPham', sql.Int, IDSanPham)
      .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
      .input('KhoiLuong', sql.Float, item.KhoiLuong)
      .input('IDDonViTinh', sql.Int, item.IDDonViTinh)
      .input('TiLeSai', sql.Float, item.TiLeSai)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_updateProduct_updateNormDetails');
  } catch (error) {
    throw error;
  }
}
//hàm xoá chi tiết định mức
async function deleteNormDetails(IDDoiTac,IDSanPham, IDNguyenLieu) {
  try {
    await pool.request()
      .input('IDSanPham', sql.Int, IDSanPham)
      .input('IDNguyenLieu', sql.Int, IDNguyenLieu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('menu_updateProduct_deleteNormDetails');
  } catch (error) {
    throw error;
  }
}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getIDDoiTac:getIDDoiTac,
  getTypeProduct: getTypeProduct,
  deleteTypeProduct: deleteTypeProduct,
  insertTypeProduct: insertTypeProduct,
  updateTypeProduct: updateTypeProduct,
  deleteProduct: deleteProduct,
  getProduct: getProduct,
  insertFinishedProduct: insertFinishedProduct,
  getListTypeProductByIDProduct: getListTypeProductByIDProduct,
  updateFinishedProduct: updateFinishedProduct,
  insertProcessedProduct: insertProcessedProduct,
  updateProcessedProduct: updateProcessedProduct,
  getListNormDetailsByIDProduct: getListNormDetailsByIDProduct,
  getListPriceProductByID:getListPriceProductByID,
  getProductByIDTypeProduct:getProductByIDTypeProduct
};