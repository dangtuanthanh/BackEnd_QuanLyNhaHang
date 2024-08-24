const db = require('../dbconfig');
const pool = db.getPool();
const sql = require('mssql');
//Kiểm tra phiên và quyền đăng nhập
async function checkSessionAndRole(ss, permission) {
  try {
    const NgayHomNay = new Date(new Date().toISOString());
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .input('NgayHomNay', sql.DateTime,NgayHomNay)
      .execute('loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap');
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
//lấy mã IDDoiTac
async function getIDDoiTac(ss) {
  try {
    let result = await pool.request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getIDDoiTac @MaDangNhap');
    return result.recordset[0].IDDoiTac;
  } catch (error) {
    throw error;
  }
}

/*  Quản lý Đơn vị tính */
//xử lý tải danh sách đơn vị tính
async function getUnit(IDDoiTac) {
  try {
    let result = await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_getUnit_getUnit');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy danh sách chuyển đổi đơn vị tính theo IDDonViTinh
async function getListUnitConversionsByIDUnit(IDDoiTac, ID) {
  try {
    const result = await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('ID', sql.Int, ID)
      .execute('inventory_getUnit_getListUnitConversionsByIDUnit');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá đơn vị tính
async function deleteUnit(IDDoiTac, ID) {
  try {
    await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('IDDonViTinh', sql.Int, ID)
      .execute('inventory_deleteUnit_deleteUnit');
  } catch (error) {
    throw error;
  }
}
//xử lý thêm đơn vị tính
async function insertUnit(IDDoiTac, data) {
  try {
    return await pool.request()
      .input('TenDonViTinh', sql.NVarChar, data.TenDonViTinh)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_insertUnit_insertUnit')
      .then(result => {
        const IDDonViTinh = result.recordset[0][''];
        // const danhSachObj = JSON.parse(data.IDDonViTinh);
        return data.DanhSach.reduce((p, item) => {
          return p.then(_ => {
            return insertUnitConversions(IDDoiTac, IDDonViTinh, item);
          });
        }, Promise.resolve());
      })
  } catch (error) {
    throw error;
  }
}
//thêm chuyển đổi đơn vị tính vào bảng chuyển đổi đơn vị tính
function insertUnitConversions(IDDoiTac, IDDonViTinh, item) {
  return pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
    .input('IDDonViCu', sql.Int, IDDonViTinh)
    .input('IDDonViMoi', sql.Int, item.IDDonViTinh)
    .input('HeSoChuyenDoi', sql.Float, item.HeSoChuyenDoi)
    .execute('inventory_insertUnit_insertUnitConversions')
    .then(result => {
      return result;
    });
}
//xử lý cập nhật đơn vị tính
async function updateUnit(IDDoiTac, data) {
  try {
    await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .input('TenDonViTinh', sql.NVarChar, data.TenDonViTinh)
      .execute('inventory_updateUnit_updateUnit');
    if (data.DanhSach.length > 0) {
      await Promise.all(
        data.DanhSach.map(async (item) => {
          // Gọi thủ tục lấy đơn vị tính cũ và đơn vị tính mới
          const oldDetail = await checkUnit(data.IDDonViTinh, item.IDDonViMoi, IDDoiTac)
          if (oldDetail.length > 0) {
            // Có thì cập nhật
            await updateUnitConversions(data.IDDonViTinh, item.IDDonViMoi, item.HeSoChuyenDoi, IDDoiTac)
          }
          else
            // Không có thì thêm
            await insertNewUnitConversions(data.IDDonViTinh, item.IDDonViMoi, item.HeSoChuyenDoi, IDDoiTac)
        })
      );

      // Kiểm tra danh sách người dùng truyền vào
      const newList = await getListUnitConversionsByIDUnit(IDDoiTac, data.IDDonViTinh)
      // Lọc các phần tử 
      const deleteList = newList.filter(item =>
        !data.DanhSach.find(detail =>
          detail['IDDonViMoi'] === item['IDDonViMoi']
        )
      );
      // Xóa các item trong deleteList
      for (const item of deleteList) {
        await deleteUnitConversions(data.IDDonViTinh, item.IDDonViMoi, IDDoiTac)
      }
    } else {
      await pool.request()
        .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute('invoice_updateUnit_deleteAllUnitConversions');
    }
    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
// lấy danh sách cũ
async function checkUnit(IDDonViCu, IDDonViMoi, IDDoiTac) {
  try {
    let result = await pool.request()
      .input('IDDonViCu', sql.Int, IDDonViCu)
      .input('IDDonViMoi', sql.Int, IDDonViMoi)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateUnit_checkUnit');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
// thêm chuyển đổi mới trong hàm cập nhật
async function insertNewUnitConversions(IDDonViCu, IDDonViMoi, HeSoChuyenDoi, IDDoiTac) {
  await pool.request()
    .input('IDDonViCu', sql.Int, IDDonViCu)
    .input('IDDonViMoi', sql.Int, IDDonViMoi)
    .input('HeSoChuyenDoi', sql.Float, HeSoChuyenDoi)
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
    .execute('inventory_insertUnit_insertUnitConversions')
}
//hàm cập nhật trong bảng chuyển đổi đơn vị tính
async function updateUnitConversions(IDDonViCu, IDDonViMoi, HeSoChuyenDoi, IDDoiTac) {
  try {
    await pool.request()
      .input('IDDonViCu', sql.Int, IDDonViCu)
      .input('IDDonViMoi', sql.Int, IDDonViMoi)
      .input('HeSoChuyenDoi', sql.Float, HeSoChuyenDoi)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateUnit_updateUnitConversions');
  } catch (error) {
    throw error;
  }
}
//hàm xoá chuyển đổi đơn vị tính
async function deleteUnitConversions(IDDonViCu, IDDonViMoi, IDDoiTac) {
  try {
    await pool.request()
      .input('IDDonViCu', sql.Int, IDDonViCu)
      .input('IDDonViMoi', sql.Int, IDDonViMoi)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('invoice_updateUnit_deleteUnitConversions');
  } catch (error) {
    throw error;
  }
}

/*  Quản lý Phiếu nhập */
//xử lý tải danh sách Phiếu nhập
async function getReceipt(IDDoiTac) {
  try {
    let result = await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_getReceipt_getReceipt');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy đơn vị tính theo ID nguyên liệu hoặc ID Sản Phẩm
async function getUnitByID(IDDoiTac, ID, isNguyenLieu) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .input('isNguyenLieu', sql.Bit, isNguyenLieu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_getUnit_getUnitByID');
    return result.recordset[0];
  } catch (error) {
    throw error;
  }
}
//Tải 1 phiếu nhập: Lấy danh sách nguyên liệu theo IDPhieuNhap
async function getListIngredientByIDReceipt(IDDoiTac, ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_getReceipt_getListIngredientByIDReceipt');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Tải 1 phiếu nhập: Lấy danh sách sản phẩm theo IDPhieuNhap
async function getListProductByIDReceipt(IDDoiTac, ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_getReceipt_getListProductByIDReceipt');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá phiếu nhập
async function deleteReceipt(IDDoiTac, ID) {
  try {
    //kiểm tra phiếu nhập là nguyên liệu hay sản phẩm
    const resultCheckTypeReceipt = await pool.request()
      .input('ID', sql.Int, ID)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_deleteReceipt_checkTypeReceipt');
    const checkTypeReceipt = resultCheckTypeReceipt.recordset[0][''];
    if (checkTypeReceipt) {// là nguyên liệu
      //lấy danh sách sản phẩm từ ID phiếu nhập
      const resultgetListIngredientByIDReceipt = await getListIngredientByIDReceipt(IDDoiTac, ID)
      // Xóa các item trong deleteList
      for (const item of resultgetListIngredientByIDReceipt) {
        await deleteDetailIngredient(IDDoiTac, ID, item)
      }
      await pool.request()
        .input('ID', sql.Int, ID)
        .input('NameTable', sql.VarChar, 'PhieuNhap')
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute('global_deleteRowTable');
    } else {// là sản phẩm
      //lấy danh sách sản phẩm từ ID phiếu nhập
      const resultgetListProductByIDReceipt = await getListProductByIDReceipt(IDDoiTac, ID)
      // Xóa các item trong deleteList
      for (const item of resultgetListProductByIDReceipt) {
        await deleteDetailFinishedProduct(IDDoiTac, ID, item)
      }
      await pool.request()
        .input('ID', sql.Int, ID)
        .input('NameTable', sql.VarChar, 'PhieuNhap')
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute('global_deleteRowTable');
    }
  } catch (error) {
    console.log('error bên này', error);
    throw error;
  }
}
//xử lý thêm phiếu nhập
async function insertReceipt(IDDoiTac, data) {
  var ghiChu = null
  if (data.GhiChu || data.GhiChu !== '') {//nếu có ghi chú
    ghiChu = data.GhiChu
  }
  const dateParts = data.NgayNhap.split('/');
  const day = dateParts[0];
  const month = dateParts[1];
  const year = dateParts[2];
  const formattedMonth = month < 10 ? `0${month}` : month;
  const formattedDay = day < 10 ? `0${day}` : day;
  const formattedDate = `${year}/${formattedMonth}/${formattedDay}`;
  try {
    const result = await pool.request()
      .input('IDNhanVien', sql.Int, data.IDNhanVien)
      .input('NgayNhap', sql.DateTime, formattedDate)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .input('NhapNguyenLieu', sql.Bit, data.NhapNguyenLieu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_insertReceipt_insertReceipt')
    const IDReceipt = result.recordset[0][''];
    await data.DanhSach.reduce(async (p, item) => {
      await p;
      if (!data.NhapNguyenLieu) {
        return insertDetailFinishedProduct(IDDoiTac, IDReceipt, item);
      } else {
        return insertDetailIngredient(IDDoiTac, IDReceipt, item);
      }
    }, Promise.resolve());
  } catch (error) {
    throw error;
  }
}
//thêm chi tiết phiếu nhập nguyên liệu
async function insertDetailIngredient(IDDoiTac, IDPhieuNhap, item) {
  var ghiChu = null
  if (item.GhiChu || item.GhiChu !== '') {//nếu có ghi chú
    ghiChu = item.GhiChu
  }
  //tạo biến số lượng tăng
  var SoLuongTang = 0
  //lấy ID đơn vị tính mặc định của sản phẩm
  const resultCurrentUnit = await getUnitByID(IDDoiTac, item.IDNguyenLieu, 1)//resultCurrentUnit.IDDonViTinh
  //kiểm tra xem dvt mặc địnhk có trùng với  dvt đang nhập hay không
  if (resultCurrentUnit.IDDonViTinh == item.IDDonViTinh) {
    //Nếu trùng thì số lượng tăng số lượng nhập
    SoLuongTang = item.SoLuongNhap
  } else {
    //khai báo biến chứa dữ liệu trùng khớp
    let matchData;
    //lấy danh sách chuyển đổi đơn vị tính
    const resultListUnitConversions = await getListUnitConversionsByIDUnit(IDDoiTac, item.IDDonViTinh)
    //kiểm tra xem đơn vị đang nhập trùng với đơn vị nào và hệ số chuyển đổi là bao nhiêu
    matchData = resultListUnitConversions.find(unit => {
      return unit.IDDonViCu === item.IDDonViTinh && unit.IDDonViMoi === resultCurrentUnit.IDDonViTinh;
    })
    SoLuongTang = item.SoLuongNhap * matchData.HeSoChuyenDoi
  }
  return pool.request()
    .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
    .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
    .input('SoLuongNhap', sql.Float, item.SoLuongNhap)
    .input('IDDonViTinh', sql.Int, item.IDDonViTinh)
    .input('DonGiaNhap', sql.Int, item.DonGiaNhap)
    .input('SoLuongTang', sql.Float, SoLuongTang)
    .input('GhiChu', sql.NVarChar, ghiChu)
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
    .execute('inventory_insertReceipt_insertDetailIngredient')
    .then(result => {
      return result;
    });
}
//thêm chi tiết phiếu nhập sản phẩm thành phẩm
async function insertDetailFinishedProduct(IDDoiTac, IDPhieuNhap, item) {
  var ghiChu = null
  if (item.GhiChu || item.GhiChu !== '') {//nếu có ghi chú
    ghiChu = item.GhiChu
  }
  //tạo biến số lượng tăng
  var SoLuongTang = 0
  //lấy ID đơn vị tính mặc định của sản phẩm
  const resultCurrentUnit = await getUnitByID(IDDoiTac, item.IDSanPham, 0)//resultCurrentUnit.IDDonViTinh
  //kiểm tra xem dvt mặc địnhk có trùng với  dvt đang nhập hay không
  if (resultCurrentUnit.IDDonViTinh == item.IDDonViTinh) {
    //Nếu trùng thì số lượng tăng số lượng nhập
    SoLuongTang = item.SoLuongNhap
  } else {
    //khai báo biến chứa dữ liệu trùng khớp
    let matchData;
    //lấy danh sách chuyển đổi đơn vị tính
    const resultListUnitConversions = await getListUnitConversionsByIDUnit(IDDoiTac, item.IDDonViTinh)
    //kiểm tra xem đơn vị đang nhập trùng với đơn vị nào và hệ số chuyển đổi là bao nhiêu
    matchData = resultListUnitConversions.find(unit => {
      return unit.IDDonViCu === item.IDDonViTinh && unit.IDDonViMoi === resultCurrentUnit.IDDonViTinh;
    })
    SoLuongTang = item.SoLuongNhap * matchData.HeSoChuyenDoi
  }
  return pool.request()
    .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
    .input('IDSanPham', sql.Int, item.IDSanPham)
    .input('SoLuongNhap', sql.Float, item.SoLuongNhap)
    .input('IDDonViTinh', sql.Int, item.IDDonViTinh)
    .input('DonGiaNhap', sql.Int, item.DonGiaNhap)
    .input('SoLuongTang', sql.Float, SoLuongTang)
    .input('GhiChu', sql.NVarChar, ghiChu)
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
    .execute('inventory_insertReceipt_insertDetailFinishedProduct')
    .then(result => {
      return result;
    });
}

//xử lý cập nhật phiếu nhập
async function updateReceipt(IDDoiTac, data) {
  try {
    var ghiChu = null;
    if (data.GhiChu || data.GhiChu !== '') {
      ghiChu = data.GhiChu;
    }
    const dateParts = data.NgayNhap.split('/');
    const day = dateParts[0];
    const month = dateParts[1];
    const year = dateParts[2];
    const formattedMonth = month < 10 ? `0${month}` : month;
    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedDate = `${year}/${formattedMonth}/${formattedDay}`;

    await pool.request()
      .input('IDPhieuNhap', sql.Int, data.IDPhieuNhap)
      .input('IDNhanVien', sql.Int, data.IDNhanVien)
      .input('NgayNhap', sql.DateTime, formattedDate)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .input('NhapNguyenLieu', sql.Bit, data.NhapNguyenLieu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateReceipt_updateReceipt');


    const result = await Promise.all(
      data.DanhSach.map(async (item) => {
        // Gọi sp lấy chi tiết cũ có IDPhieuNhap, IDNguyenLieu

        const oldDetail = await (
          data.NhapNguyenLieu
            ? getDetailIngredientByID(IDDoiTac, data.IDPhieuNhap, item.IDNguyenLieu)
            : getDetailFinishedProductByID(IDDoiTac, data.IDPhieuNhap, item.IDSanPham)
        );

        if (oldDetail.length > 0) {
          // Có thì cập nhật



          await (
            data.NhapNguyenLieu
              ? updateDetailIngredient(IDDoiTac, data.IDPhieuNhap, item)
              : updateDetailFinishedProduct(IDDoiTac, data.IDPhieuNhap, item)
          );

        } else {
          // Không có thì thêm
          await (
            data.NhapNguyenLieu
              ? insertDetailIngredient(IDDoiTac, data.IDPhieuNhap, item)
              : insertDetailFinishedProduct(IDDoiTac, data.IDPhieuNhap, item)
          );
        }
      })
    );

    // Kiểm tra danh sách người dùng truyền vào
    const newList = await (
      data.NhapNguyenLieu
        ? getListIngredientByIDReceipt(IDDoiTac, data.IDPhieuNhap)
        : getListProductByIDReceipt(IDDoiTac, data.IDPhieuNhap)
    );
    // Xoá các hàng dữ liệu không có trong danh sách người dùng truyền vào
    const idField = data.NhapNguyenLieu
      ? 'IDNguyenLieu'
      : 'IDSanPham';

    const deleteList = newList.filter(item =>
      !data.DanhSach.find(detail =>
        detail[idField] === item[idField]
      )
    );

    // Xóa các item trong deleteList
    for (const item of deleteList) {
      await (
        data.NhapNguyenLieu
          ? deleteDetailIngredient(IDDoiTac, data.IDPhieuNhap, item)
          : deleteDetailFinishedProduct(IDDoiTac, data.IDPhieuNhap, item)
      );
    }

    return { success: true, result: result };
  } catch (err) {
    throw err;
  }
}
// lấy chi tiết nguyên liệu theo ID
async function getDetailIngredientByID(IDDoiTac, IDPhieuNhap, IDNguyenLieu) {
  try {
    let result = await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDNguyenLieu', sql.Int, IDNguyenLieu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateReceipt_getDetailIngredientByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
// lấy chi tiết sản phẩm theo ID
async function getDetailFinishedProductByID(IDDoiTac, IDPhieuNhap, IDSanPham) {
  try {
    let result = await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDSanPham', sql.Int, IDSanPham)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateReceipt_getDetailFinishedProductByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//hàm cập nhật chi tiết phiếu nhập nguyên liệu
async function updateDetailIngredient(IDDoiTac, IDPhieuNhap, item) {
  try {
    var ghiChu = null;
    if (item.GhiChu || item.GhiChu !== '') {
      ghiChu = item.GhiChu;
    }
    // lấy thông tin cũ
    try {
    } catch (error) {

      console.log('lỗi đoạn này', error);
    }
    const resultOld = await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateReceipt_getIDDonViTinhSoLuongNhap');
    const IDDonViCu = resultOld.recordset[0]['IDDonViTinh']
    const SoLuongNhapCu = resultOld.recordset[0]['SoLuongNhap']
    //lấy số lượng tồn trong kho
    const resultInventory = await pool.request()
      .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .query('SELECT SoLuongTon FROM NguyenLieu WHERE IDNguyenLieu = @IDNguyenLieu AND IDDoiTac = @IDDoiTac');
    // const resultInventory = await pool.request().query(`select SoLuongTon FROM NguyenLieu WHERE IDNguyenLieu = ${item.IDNguyenLieu} AND IDDoiTac = ${IDDoiTac}`);
    const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']

    //kiểm tra đơn vị tính mới có trùng với đơn vị tính mặc đinh không
    const resultCheckEqualUnitNew = await checkEqualUnit(IDDoiTac, item.IDDonViTinh, item.IDNguyenLieu, 1)
    // kiểm tra đơn vị tính cũ có trùng với đơn vị tính mặc đinh không
    const resultCheckEqualUnitOld = await checkEqualUnit(IDDoiTac, IDDonViCu, item.IDNguyenLieu, 1)

    //kiểm tra các trường hợp của đơn vị tính
    if (resultCheckEqualUnitNew && resultCheckEqualUnitOld) {//cả 2 đều trùng vơi đơn vị tính gốc
      // so sánh số lượng nhập
      CompareImported(IDDoiTac, item.SoLuongNhap, SoLuongNhapCu, IDPhieuNhap, item.IDNguyenLieu, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, true)
    } else if (resultCheckEqualUnitNew && !resultCheckEqualUnitOld) {//mới trùng, cũ không
      //chuyển dvt cũ về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapCu = await ConvertUnit(IDDoiTac, SoLuongNhapCu, IDDonViCu, item.IDNguyenLieu, 1)
      // hai dvt đã bằng nhau và bằng mặc định
      // so sánh số lượng nhập
      CompareImported(IDDoiTac, item.SoLuongNhap, ConvertSoLuongNhapCu, IDPhieuNhap, item.IDNguyenLieu, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, true)
    } else if (!resultCheckEqualUnitNew && resultCheckEqualUnitOld) {//mới không, cũ trùng
      //chuyển dvt mới về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapMoi = await ConvertUnit(IDDoiTac, item.SoLuongNhap, item.IDDonViTinh, item.IDNguyenLieu, 1)
      // hai dvt đã bằng nhau và bằng mặc định
      // so sánh số lượng nhập
      CompareImported2(IDDoiTac, ConvertSoLuongNhapMoi, SoLuongNhapCu, IDPhieuNhap, item.IDNguyenLieu, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, item.SoLuongNhap, true)
    } else {//cả hai không trùng
      //chuyển cả 2 dvt về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapCu = await ConvertUnit(IDDoiTac, SoLuongNhapCu, IDDonViCu, item.IDNguyenLieu, 1)
      const ConvertSoLuongNhapMoi = await ConvertUnit(IDDoiTac, item.SoLuongNhap, item.IDDonViTinh, item.IDNguyenLieu, 1)
      CompareImported2(IDDoiTac, ConvertSoLuongNhapMoi, ConvertSoLuongNhapCu, IDPhieuNhap, item.IDNguyenLieu, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, item.SoLuongNhap, true)
    }
  } catch (error) {
    throw error;
  }
}

//hàm kiểm tra dvt có trùng với dvt gốc không
async function checkEqualUnit(IDDoiTac, IDDonViTinh, IDNguyenLieuorIDSanPham, isNguyenLieu) {
  try {
    const result = await pool.request()
      .input('IDDonViTinh', sql.Int, IDDonViTinh)
      .input('IDNguyenLieuorIDSanPham', sql.Int, IDNguyenLieuorIDSanPham)
      .input('isNguyenLieu', sql.Bit, isNguyenLieu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateReceipt_checkEqualUnit');
    return result.recordset[0][''];
  } catch (error) {
    throw error;
  }
}

//hàm chuyển đổi đơn vị tính
async function ConvertUnit(IDDoiTac, SoLuongNhap, IDDonViTinh, IDNguyenLieuorIDSanPham, isNguyenLieu) {
  try {
    // lấy ID ĐVT mặc định
    resultGetUnitDefault = await pool.request()
      .input('IDNguyenLieuorIDSanPham', sql.Int, IDNguyenLieuorIDSanPham)
      .input('isNguyenLieu', sql.Bit, isNguyenLieu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateReceipt_getUnitDefault');
    IDDonViTinhMacDinh = resultGetUnitDefault.recordset[0][''];
    //lấy hệ số chuyển đổi
    resultGetConversionRatio = await pool.request()
      .input('IDDonViCu', sql.Int, IDDonViTinh)
      .input('IDDonViMoi', sql.Int, IDDonViTinhMacDinh)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateReceipt_getConversionRatio');
    const heSoChuyenDoi = resultGetConversionRatio.recordset[0][''];
    // convert về ĐVT mặc định
    return (SoLuongNhap * heSoChuyenDoi)
  } catch (error) {
    throw error;
  }
}
// hàm so sánh số lượng nhập
async function CompareImported(IDDoiTac, SoLuongNhapMoi, SoLuongNhapCu, IDPhieuNhap, ID, IDDonViTinh, DonGiaNhap, ghiChu, SoLuongTon, isNguyenLieu) {
  try {
    const checkIsNguyenLieu = {
      TenCot: isNguyenLieu ? 'IDNguyenLieu' : 'IDSanPham',
      TenThuTuc: isNguyenLieu ? 'inventory_updateReceipt_updateDetailIngredient' : 'inventory_updateReceipt_updateDetailFinishedProduct',
      TenBang: isNguyenLieu ? 'NguyenLieu' : 'SanPham'
    }
    if (SoLuongNhapMoi === SoLuongNhapCu) {
      //cập nhật các cột khác của ChiTietPhieuNhap
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input(checkIsNguyenLieu.TenCot, sql.Int, ID)
        .input('SoLuongNhap', sql.Float, SoLuongNhapMoi)
        .input('IDDonViTinh', sql.Int, IDDonViTinh)
        .input('DonGiaNhap', sql.Float, DonGiaNhap)
        .input('GhiChu', sql.NVarChar, ghiChu)
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute(checkIsNguyenLieu.TenThuTuc);
    } else if (SoLuongNhapMoi > SoLuongNhapCu) {//mới lớn hơn cũ
      //cập nhật ChiTietPhieuNhap
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input(checkIsNguyenLieu.TenCot, sql.Int, ID)
        .input('SoLuongNhap', sql.Float, SoLuongNhapMoi)
        .input('IDDonViTinh', sql.Int, IDDonViTinh)
        .input('DonGiaNhap', sql.Float, DonGiaNhap)
        .input('GhiChu', sql.NVarChar, ghiChu)
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute(checkIsNguyenLieu.TenThuTuc);

      //cập nhật lại số lượng tồn trong kho
      //tính toán số lượng tồn
      await pool.request()
        .input('SoLuongTon', sql.Float, SoLuongTon + (SoLuongNhapMoi - SoLuongNhapCu))
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .input('ID', sql.Int, ID) // Giả sử ID là kiểu Int, điều chỉnh nếu cần thiết
        .query(`UPDATE ${checkIsNguyenLieu.TenBang} SET SoLuongTon = @SoLuongTon WHERE ${checkIsNguyenLieu.TenCot} = @ID AND IDDoiTac = @IDDoiTac`);

      // await pool.request().query(`UPDATE ${checkIsNguyenLieu.TenBang}
      //   SET SoLuongTon = ${SoLuongTon + (SoLuongNhapMoi - SoLuongNhapCu)}
      //   WHERE ${checkIsNguyenLieu.TenCot} = ${ID} AND IDDoiTac = ${IDDoiTac}`);
    } else if (SoLuongNhapMoi < SoLuongNhapCu) {//mới bé hơn cũ
      //cập nhật ChiTietPhieuNhap
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input(checkIsNguyenLieu.TenCot, sql.Int, ID)
        .input('SoLuongNhap', sql.Float, SoLuongNhapMoi)
        .input('IDDonViTinh', sql.Int, IDDonViTinh)
        .input('DonGiaNhap', sql.Float, DonGiaNhap)
        .input('GhiChu', sql.NVarChar, ghiChu)
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute(checkIsNguyenLieu.TenThuTuc);

      //cập nhật lại số lượng tồn trong kho
      //tính toán số lượng tồn
      await pool.request()
        .input('SoLuongTon', sql.Float, SoLuongTon - (SoLuongNhapCu - SoLuongNhapMoi))
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .input('ID', sql.Int, ID) // Điều chỉnh kiểu dữ liệu nếu cần
        .query(`
    UPDATE ${checkIsNguyenLieu.TenBang}
    SET SoLuongTon = @SoLuongTon
    WHERE ${checkIsNguyenLieu.TenCot} = @ID AND IDDoiTac = @IDDoiTac
  `);

      // await pool.request().query(`UPDATE ${checkIsNguyenLieu.TenBang}
      //   SET SoLuongTon = ${SoLuongTon - (SoLuongNhapCu - SoLuongNhapMoi)}
      //   WHERE ${checkIsNguyenLieu.TenCot} = ${ID} AND IDDoiTac = ${IDDoiTac}`);
    }
  } catch (error) {
    throw error;
  }
}

// hàm so sánh số lượng nhập 
async function CompareImported2(IDDoiTac, SoLuongNhapMoi, SoLuongNhapCu, IDPhieuNhap, ID, IDDonViTinh, DonGiaNhap, ghiChu, SoLuongTon, SoLuongNhapMoiChuaConvert, isNguyenLieu) {
  const checkIsNguyenLieu = {
    TenCot: isNguyenLieu ? 'IDNguyenLieu' : 'IDSanPham',
    TenThuTuc: isNguyenLieu ? 'inventory_updateReceipt_updateDetailIngredient' : 'inventory_updateReceipt_updateDetailFinishedProduct',
    TenBang: isNguyenLieu ? 'NguyenLieu' : 'SanPham'
  }
  if (SoLuongNhapMoi === SoLuongNhapCu) {
    //cập nhật các cột khác của ChiTietPhieuNhap
    await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input(checkIsNguyenLieu.TenCot, sql.Int, ID)
      .input('SoLuongNhap', sql.Float, SoLuongNhapMoiChuaConvert)
      .input('IDDonViTinh', sql.Int, IDDonViTinh)
      .input('DonGiaNhap', sql.Float, DonGiaNhap)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute(checkIsNguyenLieu.TenThuTuc);
  } else if (SoLuongNhapMoi > SoLuongNhapCu) {//mới lớn hơn cũ
    //cập nhật ChiTietPhieuNhap
    await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input(checkIsNguyenLieu.TenCot, sql.Int, ID)
      .input('SoLuongNhap', sql.Float, SoLuongNhapMoiChuaConvert)
      .input('IDDonViTinh', sql.Int, IDDonViTinh)
      .input('DonGiaNhap', sql.Float, DonGiaNhap)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute(checkIsNguyenLieu.TenThuTuc);

    //cập nhật lại số lượng tồn trong kho
    //tính toán số lượng tồn
    await pool.request()
      .input('SoLuongTon', sql.Float, SoLuongTon + (SoLuongNhapMoi - SoLuongNhapCu))
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .input('ID', sql.Int, ID) // Điều chỉnh kiểu dữ liệu nếu cần
      .query(`
    UPDATE ${checkIsNguyenLieu.TenBang}
    SET SoLuongTon = @SoLuongTon
    WHERE ${checkIsNguyenLieu.TenCot} = @ID AND IDDoiTac = @IDDoiTac
  `);

    // await pool.request().query(`UPDATE ${checkIsNguyenLieu.TenBang}
    //     SET SoLuongTon = ${SoLuongTon + (SoLuongNhapMoi - SoLuongNhapCu)}
    //     WHERE ${checkIsNguyenLieu.TenCot} = ${ID} AND IDDoiTac = ${IDDoiTac}`);
  } else if (SoLuongNhapMoi < SoLuongNhapCu) {//mới bé hơn cũ
    //cập nhật ChiTietPhieuNhap
    await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input(checkIsNguyenLieu.TenCot, sql.Int, ID)
      .input('SoLuongNhap', sql.Float, SoLuongNhapMoiChuaConvert)
      .input('IDDonViTinh', sql.Int, IDDonViTinh)
      .input('DonGiaNhap', sql.Float, DonGiaNhap)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute(checkIsNguyenLieu.TenThuTuc);

    //cập nhật lại số lượng tồn trong kho
    //tính toán số lượng tồn
    await pool.request()
      .input('SoLuongTon', sql.Float, SoLuongTon - (SoLuongNhapCu - SoLuongNhapMoi))
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .input('ID', sql.Int, ID) // Điều chỉnh kiểu dữ liệu nếu cần
      .query(`
    UPDATE ${checkIsNguyenLieu.TenBang}
    SET SoLuongTon = @SoLuongTon
    WHERE ${checkIsNguyenLieu.TenCot} = @ID AND IDDoiTac = @IDDoiTac
  `);

    // await pool.request().query(`UPDATE ${checkIsNguyenLieu.TenBang}
    //     SET SoLuongTon = ${SoLuongTon - (SoLuongNhapCu - SoLuongNhapMoi)}
    //     WHERE ${checkIsNguyenLieu.TenCot} = ${ID} AND IDDoiTac = ${IDDoiTac}`);
  }
}

//hàm cập nhật chi tiết phiếu nhập sản phẩm thành phẩm
async function updateDetailFinishedProduct(IDDoiTac, IDPhieuNhap, item) {
  try {
    var ghiChu = null;
    if (item.GhiChu || item.GhiChu !== '') {
      ghiChu = item.GhiChu;
    }
    // lấy thông tin cũ
    const resultOld = await pool.request()
      .input('IDSanPham', sql.Int, item.IDSanPham) // Hoặc kiểu dữ liệu phù hợp
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap) // Hoặc kiểu dữ liệu phù hợp
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .query(`
    SELECT IDDonViTinh, SoLuongNhap 
    FROM ChiTietNhapSanPham 
    WHERE IDSanPham = @IDSanPham 
      AND IDPhieuNhap = @IDPhieuNhap 
      AND IDDoiTac = @IDDoiTac
  `);

    // const resultOld = await pool.request().query(`select IDDonViTinh,SoLuongNhap FROM ChiTietNhapSanPham WHERE IDSanPham = ${item.IDSanPham} AND IDPhieuNhap = ${IDPhieuNhap} AND IDDoiTac = ${IDDoiTac}`);
    const IDDonViCu = resultOld.recordset[0]['IDDonViTinh']
    const SoLuongNhapCu = resultOld.recordset[0]['SoLuongNhap']

    //lấy số lượng tồn trong kho
    const resultInventory = await pool.request()
      .input('IDSanPham', sql.Int, item.IDSanPham) // Hoặc kiểu dữ liệu phù hợp
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .query(`
    SELECT SoLuongTon 
    FROM SanPham 
    WHERE IDSanPham = @IDSanPham 
      AND IDDoiTac = @IDDoiTac
  `);

    // const resultInventory = await pool.request().query(`select SoLuongTon FROM SanPham WHERE IDSanPham = ${item.IDSanPham} AND IDDoiTac = ${IDDoiTac}`);
    const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']
    //kiểm tra đơn vị tính mới có trùng với đơn vị tính mặc đinh không
    const resultCheckEqualUnitNew = await checkEqualUnit(IDDoiTac, item.IDDonViTinh, item.IDSanPham, false)
    // kiểm tra đơn vị tính cũ có trùng với đơn vị tính mặc đinh không
    const resultCheckEqualUnitOld = await checkEqualUnit(IDDoiTac, IDDonViCu, item.IDSanPham, false)
    //kiểm tra các trường hợp của đơn vị tính
    if (resultCheckEqualUnitNew && resultCheckEqualUnitOld) {//cả 2 đều trùng vơi đơn vị tính gốc
      console.log('TH1');
      // so sánh số lượng nhập
      CompareImported(IDDoiTac, item.SoLuongNhap, SoLuongNhapCu, IDPhieuNhap, item.IDSanPham, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, false)
    } else if (resultCheckEqualUnitNew && !resultCheckEqualUnitOld) {//mới trùng, cũ không
      console.log('TH2');
      //chuyển dvt cũ về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapCu = await ConvertUnit(IDDoiTac, SoLuongNhapCu, IDDonViCu, item.IDSanPham, false)
      // hai dvt đã bằng nhau và bằng mặc định
      // so sánh số lượng nhập
      CompareImported(IDDoiTac, item.SoLuongNhap, ConvertSoLuongNhapCu, IDPhieuNhap, item.IDSanPham, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, false)
    } else if (!resultCheckEqualUnitNew && resultCheckEqualUnitOld) {//mới không, cũ trùng
      console.log('TH3');
      //chuyển dvt mới về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapMoi = await ConvertUnit(IDDoiTac, item.SoLuongNhap, item.IDDonViTinh, item.IDSanPham, false)
      // hai dvt đã bằng nhau và bằng mặc định
      // so sánh số lượng nhập
      CompareImported2(IDDoiTac, ConvertSoLuongNhapMoi, SoLuongNhapCu, IDPhieuNhap, item.IDSanPham, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, item.SoLuongNhap, false)
    } else {//cả hai không trùng
      console.log('TH4');
      //chuyển cả 2 dvt về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapCu = await ConvertUnit(IDDoiTac, SoLuongNhapCu, IDDonViCu, item.IDSanPham, false)
      const ConvertSoLuongNhapMoi = await ConvertUnit(IDDoiTac, item.SoLuongNhap, item.IDDonViTinh, item.IDSanPham, false)
      CompareImported2(IDDoiTac, ConvertSoLuongNhapMoi, ConvertSoLuongNhapCu, IDPhieuNhap, item.IDSanPham, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, item.SoLuongNhap, false)
    }
  } catch (error) {
    throw error;
  }
}
//hàm xoá chi tiết phiếu nhập nguyên liệu
async function deleteDetailIngredient(IDDoiTac, IDPhieuNhap, item) {
  try {
    //tính toán lại số lượng tồn
    //lấy số lượng tồn trong kho
    // const resultInventory = await pool.request().query(`select SoLuongTon FROM NguyenLieu WHERE IDNguyenLieu = ${item.IDNguyenLieu} and IDDoiTac = ${IDDoiTac}`);
    const resultInventory = await pool.request()
      .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu) // Hoặc kiểu dữ liệu phù hợp
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .query(`
    SELECT SoLuongTon 
    FROM NguyenLieu 
    WHERE IDNguyenLieu = @IDNguyenLieu 
      AND IDDoiTac = @IDDoiTac
  `);

    const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']

    // kiểm tra đơn vị tính có trùng với đơn vị tính mặc định không
    const resultCheckEqualUnit = await checkEqualUnit(IDDoiTac, item.IDDonViTinh, item.IDNguyenLieu, true)
    if (resultCheckEqualUnit) { //trùng với đơn vị tính mặc định
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute('inventory_updateReceipt_deleteDetailIngredient');
      //cập nhật số lượng tồn
      await pool.request()
        .input('SoLuongTon', sql.Int, SoLuongTon - item.SoLuongNhap)
        .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
    UPDATE NguyenLieu
    SET SoLuongTon = @SoLuongTon
    WHERE IDNguyenLieu = @IDNguyenLieu AND IDDoiTac = @IDDoiTac
  `);

      // await pool.request().query(`UPDATE NguyenLieu
      // SET SoLuongTon = ${SoLuongTon - item.SoLuongNhap}
      // WHERE IDNguyenLieu = ${item.IDNguyenLieu} and IDDoiTac = ${IDDoiTac}`);
    } else {
      console.log('không trùng');
      //chuyển về cùng đơn vị tính
      const ConvertSoLuongNhap = await ConvertUnit(IDDoiTac, item.SoLuongNhap, item.IDDonViTinh, item.IDNguyenLieu, 1)
      console.log('ConvertSoLuongNhap', ConvertSoLuongNhap);
      //xoá hàng dữ liệu
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute('inventory_updateReceipt_deleteDetailIngredient');
      //cập nhật số lượng tồn
      await pool.request()
        .input('SoLuongTon', sql.Int, SoLuongTon - ConvertSoLuongNhap)
        .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
    UPDATE NguyenLieu
    SET SoLuongTon = @SoLuongTon
    WHERE IDNguyenLieu = @IDNguyenLieu AND IDDoiTac = @IDDoiTac
  `);

      // await pool.request().query(`UPDATE NguyenLieu
      // SET SoLuongTon = ${SoLuongTon - ConvertSoLuongNhap}
      // WHERE IDNguyenLieu = ${item.IDNguyenLieu} and IDDoiTac = ${IDDoiTac}`);
    }

  } catch (error) {
    throw error;
  }
}
//hàm xoá chi tiết phiếu nhập sản phẩm thành phẩm
async function deleteDetailFinishedProduct(IDDoiTac, IDPhieuNhap, item) {
  try {
    //lấy số lượng tồn trong kho
    const resultInventory = await pool.request()
      .input('IDSanPham', sql.Int, item.IDSanPham)
      .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
      .query(`
    SELECT SoLuongTon 
    FROM SanPham 
    WHERE IDSanPham = @IDSanPham AND IDDoiTac = @IDDoiTac
  `);

    // const resultInventory = await pool.request().query(`select SoLuongTon FROM SanPham WHERE IDSanPham= ${item.IDSanPham} AND IDDoiTac = ${IDDoiTac}`);
    const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']

    // kiểm tra đơn vị tính có trùng với đơn vị tính mặc định không
    const resultCheckEqualUnit = await checkEqualUnit(IDDoiTac, item.IDDonViTinh, item.IDSanPham, false)
    if (resultCheckEqualUnit) { //trùng với đơn vị tính mặc định
      console.log('trùng');
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input('IDSanPham', sql.Int, item.IDSanPham)
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute('inventory_updateReceipt_deleteDetailFinishedProduct');
      //cập nhật số lượng tồn
      await pool.request()
        .input('SoLuongTon', sql.Int, SoLuongTon - item.SoLuongNhap)
        .input('IDSanPham', sql.Int, item.IDSanPham)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
    UPDATE SanPham
    SET SoLuongTon = @SoLuongTon
    WHERE IDSanPham = @IDSanPham AND IDDoiTac = @IDDoiTac
  `);

      // await pool.request().query(`UPDATE SanPham
      // SET SoLuongTon = ${SoLuongTon - item.SoLuongNhap}
      // WHERE IDSanPham = ${item.IDSanPham} AND IDDoiTac = ${IDDoiTac}`);
    } else {
      console.log('không trùng');
      //chuyển về cùng đơn vị tính
      const ConvertSoLuongNhap = await ConvertUnit(IDDoiTac, item.SoLuongNhap, item.IDDonViTinh, item.IDSanPham, false)
      console.log('ConvertSoLuongNhap', ConvertSoLuongNhap);
      //xoá hàng dữ liệu
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input('IDSanPham', sql.Int, item.IDSanPham)
        .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
        .execute('inventory_updateReceipt_deleteDetailFinishedProduct');
      //cập nhật số lượng tồn
      await pool.request()
        .input('SoLuongTon', sql.Int, SoLuongTon - ConvertSoLuongNhap)
        .input('IDSanPham', sql.Int, item.IDSanPham)
        .input('IDDoiTac', sql.UniqueIdentifier, IDDoiTac)
        .query(`
    UPDATE SanPham
    SET SoLuongTon = @SoLuongTon
    WHERE IDSanPham = @IDSanPham AND IDDoiTac = @IDDoiTac
  `);

      // await pool.request().query(`UPDATE SanPham
      // SET SoLuongTon = ${SoLuongTon - ConvertSoLuongNhap}
      // WHERE IDSanPham = ${item.IDSanPham} AND IDDoiTac = ${IDDoiTac}`);
    }
  } catch (error) {
    throw error;
  }
}


//xử lý lấy danh sách nguyên liệu
async function getIngredient(IDDoiTac) {
  try {
    let result = await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_getIngredient_getIngredient');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá nguyên liệu
async function deleteIngredient(IDDoiTac, ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .input('NameTable', sql.VarChar, 'NguyenLieu')
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('global_deleteRowTable');
  } catch (error) {
    throw error;
  }
}
//xử lý thêm nguyên liệu
async function insertIngredient(IDDoiTac, data) {
  try {
    await pool.request()
      .input('TenNguyenLieu', sql.NVarChar, data.TenNguyenLieu)
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_insertIngredient_insertIngredient');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
//xử lý cập nhật nguyên liệu
async function updateIngredient(IDDoiTac, data) {
  try {
    await pool.request()
      .input('IDNguyenLieu', sql.Int, data.IDNguyenLieu)
      .input('TenNguyenLieu', sql.NVarChar, data.TenNguyenLieu)
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('inventory_updateIngredient_updateIngredient');
    return { success: true };
  } catch (error) {
    throw error;
  }
}


module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getIDDoiTac: getIDDoiTac,
  getUnit: getUnit,
  deleteUnit: deleteUnit,
  insertUnit: insertUnit,
  updateUnit: updateUnit,
  getReceipt: getReceipt,
  deleteReceipt: deleteReceipt,
  getListIngredientByIDReceipt: getListIngredientByIDReceipt,
  getListProductByIDReceipt: getListProductByIDReceipt,
  insertReceipt: insertReceipt,
  updateReceipt: updateReceipt,
  getIngredient: getIngredient,
  deleteIngredient: deleteIngredient,
  insertIngredient: insertIngredient,
  updateIngredient: updateIngredient,
  getListUnitConversionsByIDUnit: getListUnitConversionsByIDUnit,
  getUnitByID: getUnitByID
};