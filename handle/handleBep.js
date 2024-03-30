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

/*  Quản lý bếp */
//xử lý tải danh sách món ăn đang trong trạng thái báo bếp
async function getListProductsByStatus(ID, ID2) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .input('ID2', sql.Int, ID2)
      .execute('kitchen_getProduct_getListProductsByStatus')
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//cập nhật trạng thái sản phẩm trong bếp
async function updateStatusProduct(data) {
  try {
    //kiểm tra trạng thái :
    console.log('data.IDTrangThai', data.IDTrangThai);

    //1.1 kiểm tra sản phẩm là thành phẩm hay chế biến
    const resultCheckTypeProduct = await pool.request()
      .input('ID', sql.Int, data.IDSanPham)
      .execute('kitchen_updateStatusProduct_checkTypeProduct');
    const checkTypeProduct = resultCheckTypeProduct.recordset[0][''];
    if (data.IDTrangThai == 2) {//chế biến xong, nếu là sản phẩm chế biến thì trừ kho
      // 1. trừ số lượng tồn trong kho
      if (!checkTypeProduct) {// nếu là sản phẩm chế biến thì trừ SLT của các nguyên liệu theo định mức
        //lấy danh sách định mức thông qua bảng định mức
        const resultGetListNormDetailsByIDProduct = await pool.request()
          .input('ID', sql.Int, data.IDSanPham)
          .execute('menu_getProduct_getListNormDetailsByIDProduct');
        const ListNormDetails = resultGetListNormDetailsByIDProduct.recordset
        for (const item of ListNormDetails) {
          await updateNumberInventory(item, data.SoLuong)
        }
        // 2. cập nhật trạng thái thành 2: đã nấu xong
        await pool.request()
          .input('IDHoaDon', sql.Int, data.IDHoaDon)
          .input('IDSanPham', sql.Int, data.IDSanPham)
          .input('IDTrangThai', sql.Int, 2)
          .execute('kitchen_updateStatusProduct_updateStatusProduct');
        console.log('nấu xong');
      }
    } else if (data.IDTrangThai == 3) {
      if (checkTypeProduct) {
        //nếu là sản phẩm thành phẩm thì trừ trực tiếp vào số lượng tồn của sản phẩm đó
        // lấy số lượng tồn hiện tại của sản phẩm đó
        const resultInventory = await pool.request().query(`select SoLuongTon FROM SanPham WHERE IDSanPham = ${data.IDSanPham}`);
        const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']
        //cập nhật số lượng tồn
        await pool.request().query(`UPDATE SanPham SET SoLuongTon = ${SoLuongTon - data.SoLuong}
        WHERE IDSanPham = ${data.IDSanPham}`);
      }
      await pool.request()
        .input('IDHoaDon', sql.Int, data.IDHoaDon)
        .input('IDSanPham', sql.Int, data.IDSanPham)
        .input('IDTrangThai', sql.Int, 3)
        .execute('kitchen_updateStatusProduct_updateStatusProduct');
      console.log('đã giao cho khách');
    }
    else if (data.IDTrangThai == 4) {// bằng 4: đã huỷ chế biến
      console.log(' đầu bếp huỷ chế biến');
      await pool.request()
        .input('IDHoaDon', sql.Int, data.IDHoaDon)
        .input('IDSanPham', sql.Int, data.IDSanPham)
        .input('IDTrangThai', sql.Int, 4)
        .execute('kitchen_updateStatusProduct_updateStatusProduct')
      //
    }

    if (data.TrangThaiMonHienTai == 4) {
      console.log('báo khách, món đã bị huỷ');
      //xoá nó khỏi danh sách hoá đơn
      await pool.request()
        .input('IDHoaDon', sql.Int, data.IDHoaDon)
        .input('IDSanPham', sql.Int, data.IDSanPham)
        .execute('invoice_updateInvoice_deleteInvoiceDetails');
    }

  } catch (error) {
    throw error;
  }
}
//hàm trừ nguyên liệu
async function updateNumberInventory(item, SoLuong) {
  try {
    //tính toán lại số lượng tồn
    //lấy số lượng tồn trong kho
    const resultInventory = await pool.request().query(`select SoLuongTon FROM NguyenLieu WHERE IDNguyenLieu = ${item.IDNguyenLieu}`);
    const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']

    // kiểm tra đơn vị tính có trùng với đơn vị tính mặc định không
    const resultCheckEqualUnit = await checkEqualUnit(item.IDDonViTinh, item.IDNguyenLieu, true)
    console.log('resultCheckEqualUnit', resultCheckEqualUnit);
    if (resultCheckEqualUnit) { //trùng với đơn vị tính mặc định
      //cập nhật số lượng tồn
      await pool.request().query(`UPDATE NguyenLieu
      SET SoLuongTon = ${SoLuongTon - ((item.KhoiLuong + item.TiLeSai) * SoLuong)}
      WHERE IDNguyenLieu = ${item.IDNguyenLieu}`);
    } else {//khác với đơn vị tính mặc định
      //chuyển về cùng đơn vị tính
      const Convert = await ConvertUnit(item.KhoiLuong, item.IDDonViTinh, item.IDNguyenLieu, true)
      const Convert2 = await ConvertUnit(item.TiLeSai, item.IDDonViTinh, item.IDNguyenLieu, true)
      console.log('ConvertKhoiLuong', Convert);
      //cập nhật số lượng tồn
      await pool.request().query(`UPDATE NguyenLieu
      SET SoLuongTon =${SoLuongTon - ((Convert + Convert2) * SoLuong)}
      WHERE IDNguyenLieu = ${item.IDNguyenLieu}`);
    }

  } catch (error) {
    throw error;
  }
}

//hàm kiểm tra dvt có trùng với dvt gốc không
async function checkEqualUnit(IDDonViTinh, IDNguyenLieuorIDSanPham, isNguyenLieu) {
  try {
    const result = await pool.request()
      .input('IDDonViTinh', sql.Int, IDDonViTinh)
      .input('IDNguyenLieuorIDSanPham', sql.Int, IDNguyenLieuorIDSanPham)
      .input('isNguyenLieu', sql.Bit, isNguyenLieu)
      .execute('inventory_updateReceipt_checkEqualUnit');
    return result.recordset[0][''];
  } catch (error) {
    throw error;
  }
}
//hàm chuyển đổi đơn vị tính
async function ConvertUnit(SoLuongNhap, IDDonViTinh, IDNguyenLieuorIDSanPham, isNguyenLieu) {
  try {
    // lấy ID ĐVT mặc định
    resultGetUnitDefault = await pool.request()
      .input('IDNguyenLieuorIDSanPham', sql.Int, IDNguyenLieuorIDSanPham)
      .input('isNguyenLieu', sql.Bit, isNguyenLieu)
      .execute('inventory_updateReceipt_getUnitDefault');
    IDDonViTinhMacDinh = resultGetUnitDefault.recordset[0][''];
    //lấy hệ số chuyển đổi
    resultGetConversionRatio = await pool.request()
      .input('IDDonViCu', sql.Int, IDDonViTinh)
      .input('IDDonViMoi', sql.Int, IDDonViTinhMacDinh)
      .execute('inventory_updateReceipt_getConversionRatio');
    const heSoChuyenDoi = resultGetConversionRatio.recordset[0][''];
    // convert về ĐVT mặc định
    return (SoLuongNhap * heSoChuyenDoi)
  } catch (error) {
    throw error;
  }
}


module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getListProductsByStatus: getListProductsByStatus,
  updateStatusProduct: updateStatusProduct
};