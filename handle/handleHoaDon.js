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




//xử lý thêm hoá đơn
async function insertInvoice(data) {
  try {
    //Tiền chưa giảm giá
    var TongTien = data.DanhSach.reduce((total, item) => {
      return total + item.SoLuong * item.GiaBan;
    }, 0)
    if (data.GiamGia && data.PhuongThucGiamGia === 'Phần Trăm') {
      TongTien = TongTien - (TongTien * data.GiamGia / 100)
    }
    if (data.GiamGia && data.PhuongThucGiamGia === 'Tiền Trực Tiếp') {
      TongTien = TongTien - data.GiamGia
    }
    const result = await pool.request()
      .input('IDBan', sql.Int, data.IDBan)
      .input('IDNhanVien', sql.Int, data.IDNhanVien)
      .input('IDKhachHang', sql.Int, data.IDKhachHang)
      .input('NgayLapHoaDon', sql.DateTime, data.NgayLapHoaDon)
      .input('TenKhuVuc', sql.NVarChar, data.TenKhuVuc)
      .input('GiamGia', sql.Float, data.GiamGia)
      .input('PhuongThucGiamGia', sql.NVarChar, data.PhuongThucGiamGia)
      .input('TongTien', sql.Float, TongTien)
      .input('GhiChu', sql.NVarChar, data.GhiChu)
      .input('TrangThaiThanhToan', sql.Bit, data.TrangThaiThanhToan)
      .input('ThanhToanChuyenKhoan', sql.Bit, data.ThanhToanChuyenKhoan)
      .execute('invoice_insertInvoice_insertInvoice')
    const IDHoaDon = result.recordset[0][''];
    // const danhSachObj = JSON.parse(data.DanhSach);
    await Promise.all(
      data.DanhSach.map(dish => insertInvoiceDetails(IDHoaDon, dish))  
    );

    // Trả về kết quả
    return {
      IDHoaDon:IDHoaDon, 
      DanhSach: data.DanhSach
    };

  } catch (error) {
    throw error;
  }
}
//thêm chi tiết hoá đơn vào bảng chi tiết hoá đơn
function insertInvoiceDetails(ID, item) {
  var ghiChu = null
  if (item.GhiChu || item.GhiChu !== '') {//nếu có ghi chú
    ghiChu = item.GhiChu
  }
  return pool.request()
    .input('IDHoaDon', sql.Int, ID)
    .input('IDSanPham', sql.Int, item.IDSanPham)
    .input('SoLuong', sql.Int, item.SoLuong)
    .input('GhiChu', sql.NVarChar, ghiChu)
    .input('ThanhTien', sql.Float, item.SoLuong * item.GiaBan)
    .execute('invoice_insertInvoice_insertInvoiceDetails')
    .then(result => {
      return result;
    });
}

//xử lý lấy danh sách chi tiết hoá đơn theo ID hoá đơn
async function getListInvoiceDetailsByID(ID) {
  try {
    const result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('invoice_getInvoice_getListInvoiceDetailsByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật hoá đơn
async function updateInvoice(data) {
  try {
    console.log(data.GiamGia);
    console.log(data.PhuongThucGiamGia);
    //Tiền chưa giảm giá
    var TongTien = data.DanhSach.reduce((total, item) => {
      return total + item.SoLuong * item.GiaBan;
    }, 0)
    if (data.GiamGia && data.PhuongThucGiamGia === 'Phần Trăm') {
      TongTien = TongTien - (TongTien * data.GiamGia / 100)
    }
    if (data.GiamGia && data.PhuongThucGiamGia === 'Tiền Trực Tiếp') {
      TongTien = TongTien - data.GiamGia
    }
    await pool.request()
      .input('IDHoaDon', sql.Int, data.IDHoaDon)
      .input('IDBan', sql.Int, data.IDBan)
      .input('IDNhanVien', sql.Int, data.IDNhanVien)
      .input('IDKhachHang', sql.Int, data.IDKhachHang)
      .input('TenKhuVuc', sql.NVarChar, data.TenKhuVuc)
      .input('NgayLapHoaDon', sql.DateTime, data.NgayLapHoaDon)
      .input('TrangThaiThanhToan', sql.Bit, data.TrangThaiThanhToan)
      .input('GhiChu', sql.NVarChar, data.GhiChu)
      .input('GiamGia', sql.Float, data.GiamGia)
      .input('PhuongThucGiamGia', sql.NVarChar, data.PhuongThucGiamGia)
      .input('ThanhToanChuyenKhoan', sql.Bit, data.ThanhToanChuyenKhoan)
      .input('TongTien', sql.Float, TongTien)
      .execute('invoice_updateInvoice_updateInvoice');
    //const danhSachObj = JSON.parse(data.DanhSach);
    await Promise.all(
      data.DanhSach.map(async (item) => {
        // Gọi thủ tục lấy chi tiết hoá đơn cũ có IDHoaDon, IDSanPham
        const oldDetail = await getInvoiceDetailsByID(data.IDHoaDon, item.IDSanPham)
        if (oldDetail.length > 0)
          // Có thì cập nhật
          await updateInvoiceDetails(data.IDHoaDon, item)
        else
          // Không có thì thêm
          await insertInvoiceDetails(data.IDHoaDon, item)
      })
    );

    // Kiểm tra danh sách người dùng truyền vào
    const newList = await getListInvoiceDetailsByID(data.IDHoaDon)
    // Xoá các hàng dữ liệu không có trong danh sách người dùng truyền vào
    const idField = 'IDSanPham'
    const deleteList = newList.filter(item =>
      !data.DanhSach.find(detail =>
        detail[idField] === item[idField]
      )
    );

    // Xóa các item trong deleteList
    for (const item of deleteList) {
      await deleteInvoiceDetails(data.IDHoaDon, item.IDSanPham)
    }

    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// lấy chi tiết hoá đơn theo ID
async function getInvoiceDetailsByID(IDHoaDon, IDSanPham) {
  try {
    let result = await pool.request()
      .input('IDHoaDon', sql.Int, IDHoaDon)
      .input('IDSanPham', sql.Int, IDSanPham)
      .execute('invoice_updateInvoice_getInvoiceDetailsByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//hàm cập nhật chi tiết hoá đơn
async function updateInvoiceDetails(IDHoaDon, item) {
  try {
    var ghiChu = null
    if (item.GhiChu || item.GhiChu !== '') {//nếu có ghi chú
      ghiChu = item.GhiChu
    }
    await pool.request()
      .input('IDHoaDon', sql.Int, IDHoaDon)
      .input('IDSanPham', sql.Int, item.IDSanPham)
      .input('SoLuong', sql.Int, item.SoLuong)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .input('ThanhTien', sql.Float, item.SoLuong * item.GiaBan)
      .execute('invoice_updateInvoice_updateInvoiceDetails');
  } catch (error) {
    throw error;
  }
}
//hàm xoá chi tiết hoá đơn
async function deleteInvoiceDetails(IDHoaDon, IDSanPham) {
  try {
    await pool.request()
      .input('IDHoaDon', sql.Int, IDHoaDon)
      .input('IDSanPham', sql.Int, IDSanPham)
      .execute('invoice_updateInvoice_deleteInvoiceDetails');
  } catch (error) {
    throw error;
  }
}



//Hàm xoá hoá đơn
async function deleteInvoice(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .execute('invoice_deleteInvoice_deleteInvoice');
  } catch (error) {
    throw error;
  }
}
//hàm cập nhật trạng thái bàn ăn
async function updateStatusTable(data) {
  try {
    await pool.request()
      .input('IDBan', sql.Int, data.IDBan)
      .input('TrangThai', sql.NVarChar, data.TrangThai)
      .execute('invoice_updateInvoice_updateStatusTable');
  } catch (error) {
    throw error;
  }
}
//xử lý tải ảnh thanh toán
async function getPicturePayment() {
  try {
    const result = await pool.request().query('EXEC invoice_getPicturePayment');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getInvoice: getInvoice,
  deleteInvoice: deleteInvoice,
  insertInvoice: insertInvoice,
  updateInvoice: updateInvoice,
  getListInvoiceDetailsByID: getListInvoiceDetailsByID,
  updateStatusTable: updateStatusTable,
  getPicturePayment: getPicturePayment
};