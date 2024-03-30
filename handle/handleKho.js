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
//xử lý lấy đơn vị tính theo ID nguyên liệu hoặc ID Sản Phẩm
async function getUnitByID(ID, isNguyenLieu) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .input('isNguyenLieu', sql.Bit, isNguyenLieu)
      .execute('inventory_getUnit_getUnitByID');
    return result.recordset[0];
  } catch (error) {
    throw error;
  }
}
//xử lý lấy danh sách chuyển đổi đơn vị tính theo IDDonViTinh
async function getListUnitConversionsByIDUnit(ID) {
  try {
    const result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('inventory_getUnit_getListUnitConversionsByIDUnit');
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
    return await pool.request()
      .input('TenDonViTinh', sql.NVarChar, data.TenDonViTinh)
      .execute('inventory_insertUnit_insertUnit')
      .then(result => {
        console.log('result', result);
        const IDDonViTinh = result.recordset[0][''];
        // const danhSachObj = JSON.parse(data.IDDonViTinh);
        return data.DanhSach.reduce((p, item) => {
          return p.then(_ => {
            return insertUnitConversions(IDDonViTinh, item);
          });
        }, Promise.resolve());
      })
  } catch (error) {
    throw error;
  }
}

//thêm chuyển đổi đơn vị tính vào bảng chuyển đổi đơn vị tính
function insertUnitConversions(IDDonViTinh, item) {
  return pool.request()
    .input('IDDonViCu', sql.Int, IDDonViTinh)
    .input('IDDonViMoi', sql.Int, item.IDDonViTinh)
    .input('HeSoChuyenDoi', sql.Float, item.HeSoChuyenDoi)
    .execute('inventory_insertUnit_insertUnitConversions')
    .then(result => {
      return result;
    });
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
    //kiểm tra phiếu nhập là nguyên liệu hay sản phẩm
    const resultCheckTypeReceipt = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('inventory_deleteReceipt_checkTypeReceipt');
    const checkTypeReceipt = resultCheckTypeReceipt.recordset[0][''];

    if (checkTypeReceipt) {// là nguyên liệu
      //lấy danh sách sản phẩm từ ID phiếu nhập
      const resultgetListIngredientByIDReceipt = await getListIngredientByIDReceipt(ID)
      // Xóa các item trong deleteList
      for (const item of resultgetListIngredientByIDReceipt) {
        await deleteDetailIngredient(ID, item)
      }
      await pool.request()
        .input('ID', sql.Int, ID)
        .input('NameTable', sql.VarChar, 'PhieuNhap')
        .execute('global_deleteRowTable');
    }else {// là sản phẩm
      //lấy danh sách sản phẩm từ ID phiếu nhập
      const resultgetListProductByIDReceipt = await getListProductByIDReceipt(ID)
      // Xóa các item trong deleteList
      for (const item of resultgetListProductByIDReceipt) {
        await deleteDetailFinishedProduct(ID, item)
      }
      await pool.request()
        .input('ID', sql.Int, ID)
        .input('NameTable', sql.VarChar, 'PhieuNhap')
        .execute('global_deleteRowTable');
    }
  } catch (error) {
    throw error;
  }
}
//xử lý thêm phiếu nhập
async function insertReceipt(data) {
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
      .execute('inventory_insertReceipt_insertReceipt')
    const IDReceipt = result.recordset[0][''];
    await data.DanhSach.reduce(async (p, item) => {
      await p;
      if (!data.NhapNguyenLieu) {
        return insertDetailFinishedProduct(IDReceipt, item);
      } else {
        return insertDetailIngredient(IDReceipt, item);
      }
    }, Promise.resolve());
  } catch (error) {
    throw error;
  }
}

//thêm chi tiết phiếu nhập nguyên liệu
async function insertDetailIngredient(IDPhieuNhap, item) {
  var ghiChu = null
  if (item.GhiChu || item.GhiChu !== '') {//nếu có ghi chú
    ghiChu = item.GhiChu
  }
  //tạo biến số lượng tăng
  var SoLuongTang = 0
  //lấy ID đơn vị tính mặc định của sản phẩm
  const resultCurrentUnit = await getUnitByID(item.IDNguyenLieu, 1)//resultCurrentUnit.IDDonViTinh
  //kiểm tra xem dvt mặc địnhk có trùng với  dvt đang nhập hay không
  if (resultCurrentUnit.IDDonViTinh == item.IDDonViTinh) {
    //Nếu trùng thì số lượng tăng số lượng nhập
    SoLuongTang = item.SoLuongNhap
  } else {
    //khai báo biến chứa dữ liệu trùng khớp
    let matchData;
    //lấy danh sách chuyển đổi đơn vị tính
    const resultListUnitConversions = await getListUnitConversionsByIDUnit(item.IDDonViTinh)
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
    .execute('inventory_insertReceipt_insertDetailIngredient')
    .then(result => {
      return result;
    });
}
//thêm chi tiết phiếu nhập sản phẩm thành phẩm
async function insertDetailFinishedProduct(IDPhieuNhap, item) {
  var ghiChu = null
  if (item.GhiChu || item.GhiChu !== '') {//nếu có ghi chú
    ghiChu = item.GhiChu
  }
  //tạo biến số lượng tăng
  var SoLuongTang = 0
  //lấy ID đơn vị tính mặc định của sản phẩm
  const resultCurrentUnit = await getUnitByID(item.IDSanPham, 0)//resultCurrentUnit.IDDonViTinh
  //kiểm tra xem dvt mặc địnhk có trùng với  dvt đang nhập hay không
  if (resultCurrentUnit.IDDonViTinh == item.IDDonViTinh) {
    //Nếu trùng thì số lượng tăng số lượng nhập
    SoLuongTang = item.SoLuongNhap
  } else {
    //khai báo biến chứa dữ liệu trùng khớp
    let matchData;
    //lấy danh sách chuyển đổi đơn vị tính
    const resultListUnitConversions = await getListUnitConversionsByIDUnit(item.IDDonViTinh)
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
    .execute('inventory_insertReceipt_insertDetailFinishedProduct')
    .then(result => {
      return result;
    });
}

//xử lý cập nhật phiếu nhập
async function updateReceipt(data) {
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
      .execute('inventory_updateReceipt_updateReceipt');

    const result = await Promise.all(
      data.DanhSach.map(async (item) => {
        // Gọi sp lấy chi tiết cũ có IDPhieuNhap, IDNguyenLieu
        const oldDetail = await (
          data.NhapNguyenLieu
            ? getDetailIngredientByID(data.IDPhieuNhap, item.IDNguyenLieu)
            : getDetailFinishedProductByID(data.IDPhieuNhap, item.IDSanPham)
        );
        if (oldDetail.length > 0) {
          // Có thì cập nhật
          await (
            data.NhapNguyenLieu
              ? updateDetailIngredient(data.IDPhieuNhap, item)
              : updateDetailFinishedProduct(data.IDPhieuNhap, item)
          );
        } else {
          // Không có thì thêm
          await (
            data.NhapNguyenLieu
              ? insertDetailIngredient(data.IDPhieuNhap, item)
              : insertDetailFinishedProduct(data.IDPhieuNhap, item)
          );
        }
      })
    );

    // Kiểm tra danh sách người dùng truyền vào
    const newList = await (
      data.NhapNguyenLieu
        ? getListIngredientByIDReceipt(data.IDPhieuNhap)
        : getListProductByIDReceipt(data.IDPhieuNhap)
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
          ? deleteDetailIngredient(data.IDPhieuNhap, item)
          : deleteDetailFinishedProduct(data.IDPhieuNhap, item)
      );
    }

    return { success: true, result: result };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
// lấy chi tiết nguyên liệu theo ID
async function getDetailIngredientByID(IDPhieuNhap, IDNguyenLieu) {
  try {
    let result = await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDNguyenLieu', sql.Int, IDNguyenLieu)
      .execute('inventory_updateReceipt_getDetailIngredientByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
// lấy chi tiết sản phẩm theo ID
async function getDetailFinishedProductByID(IDPhieuNhap, IDSanPham) {
  try {
    let result = await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDSanPham', sql.Int, IDSanPham)
      .execute('inventory_updateReceipt_getDetailFinishedProductByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//hàm cập nhật chi tiết phiếu nhập nguyên liệu
async function updateDetailIngredient(IDPhieuNhap, item) {
  try {
    var ghiChu = null;
    if (item.GhiChu || item.GhiChu !== '') {
      ghiChu = item.GhiChu;
    }
    // lấy thông tin cũ
    const resultOld = await pool.request().query(`select IDDonViTinh,SoLuongNhap FROM ChiTietNhapNguyenLieu WHERE IDNguyenLieu = ${item.IDNguyenLieu} AND IDPhieuNhap = ${IDPhieuNhap}`);
    const IDDonViCu = resultOld.recordset[0]['IDDonViTinh']
    const SoLuongNhapCu = resultOld.recordset[0]['SoLuongNhap']

    //lấy số lượng tồn trong kho
    const resultInventory = await pool.request().query(`select SoLuongTon FROM NguyenLieu WHERE IDNguyenLieu = ${item.IDNguyenLieu}`);
    const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']

    //kiểm tra đơn vị tính mới có trùng với đơn vị tính mặc đinh không
    const resultCheckEqualUnitNew = await checkEqualUnit(item.IDDonViTinh, item.IDNguyenLieu, 1)
    // kiểm tra đơn vị tính cũ có trùng với đơn vị tính mặc đinh không
    const resultCheckEqualUnitOld = await checkEqualUnit(IDDonViCu, item.IDNguyenLieu, 1)

    //kiểm tra các trường hợp của đơn vị tính
    if (resultCheckEqualUnitNew && resultCheckEqualUnitOld) {//cả 2 đều trùng vơi đơn vị tính gốc
      // so sánh số lượng nhập
      CompareImported(item.SoLuongNhap, SoLuongNhapCu, IDPhieuNhap, item.IDNguyenLieu, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, true)
    } else if (resultCheckEqualUnitNew && !resultCheckEqualUnitOld) {//mới trùng, cũ không
      //chuyển dvt cũ về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapCu = await ConvertUnit(SoLuongNhapCu, IDDonViCu, item.IDNguyenLieu, 1)
      // hai dvt đã bằng nhau và bằng mặc định
      // so sánh số lượng nhập
      CompareImported(item.SoLuongNhap, ConvertSoLuongNhapCu, IDPhieuNhap, item.IDNguyenLieu, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, true)
    } else if (!resultCheckEqualUnitNew && resultCheckEqualUnitOld) {//mới không, cũ trùng
      //chuyển dvt mới về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapMoi = await ConvertUnit(item.SoLuongNhap, item.IDDonViTinh, item.IDNguyenLieu, 1)
      // hai dvt đã bằng nhau và bằng mặc định
      // so sánh số lượng nhập
      CompareImported2(ConvertSoLuongNhapMoi, SoLuongNhapCu, IDPhieuNhap, item.IDNguyenLieu, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, item.SoLuongNhap, true)
    } else {//cả hai không trùng
      //chuyển cả 2 dvt về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapCu = await ConvertUnit(SoLuongNhapCu, IDDonViCu, item.IDNguyenLieu, 1)
      const ConvertSoLuongNhapMoi = await ConvertUnit(item.SoLuongNhap, item.IDDonViTinh, item.IDNguyenLieu, 1)
      CompareImported2(ConvertSoLuongNhapMoi, ConvertSoLuongNhapCu, IDPhieuNhap, item.IDNguyenLieu, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, item.SoLuongNhap, true)
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
// hàm so sánh số lượng nhập
async function CompareImported(SoLuongNhapMoi, SoLuongNhapCu, IDPhieuNhap, ID, IDDonViTinh, DonGiaNhap, ghiChu, SoLuongTon, isNguyenLieu) {
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
        .execute(checkIsNguyenLieu.TenThuTuc);

      //cập nhật lại số lượng tồn trong kho
      //tính toán số lượng tồn
      await pool.request().query(`UPDATE ${checkIsNguyenLieu.TenBang}
        SET SoLuongTon = ${SoLuongTon + (SoLuongNhapMoi - SoLuongNhapCu)}
        WHERE ${checkIsNguyenLieu.TenCot} = ${ID}`);
    } else if (SoLuongNhapMoi < SoLuongNhapCu) {//mới bé hơn cũ
      //cập nhật ChiTietPhieuNhap
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input(checkIsNguyenLieu.TenCot, sql.Int, ID)
        .input('SoLuongNhap', sql.Float, SoLuongNhapMoi)
        .input('IDDonViTinh', sql.Int, IDDonViTinh)
        .input('DonGiaNhap', sql.Float, DonGiaNhap)
        .input('GhiChu', sql.NVarChar, ghiChu)
        .execute(checkIsNguyenLieu.TenThuTuc);

      //cập nhật lại số lượng tồn trong kho
      //tính toán số lượng tồn
      await pool.request().query(`UPDATE ${checkIsNguyenLieu.TenBang}
        SET SoLuongTon = ${SoLuongTon - (SoLuongNhapCu - SoLuongNhapMoi)}
        WHERE ${checkIsNguyenLieu.TenCot} = ${ID}`);
    }
  } catch (error) {
    throw error;
  }
}

// hàm so sánh số lượng nhập 
async function CompareImported2(SoLuongNhapMoi, SoLuongNhapCu, IDPhieuNhap, ID, IDDonViTinh, DonGiaNhap, ghiChu, SoLuongTon, SoLuongNhapMoiChuaConvert, isNguyenLieu) {
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
      .execute(checkIsNguyenLieu.TenThuTuc);

    //cập nhật lại số lượng tồn trong kho
    //tính toán số lượng tồn
    await pool.request().query(`UPDATE ${checkIsNguyenLieu.TenBang}
        SET SoLuongTon = ${SoLuongTon + (SoLuongNhapMoi - SoLuongNhapCu)}
        WHERE ${checkIsNguyenLieu.TenCot} = ${ID}`);
  } else if (SoLuongNhapMoi < SoLuongNhapCu) {//mới bé hơn cũ
    //cập nhật ChiTietPhieuNhap
    await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input(checkIsNguyenLieu.TenCot, sql.Int, ID)
      .input('SoLuongNhap', sql.Float, SoLuongNhapMoiChuaConvert)
      .input('IDDonViTinh', sql.Int, IDDonViTinh)
      .input('DonGiaNhap', sql.Float, DonGiaNhap)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .execute(checkIsNguyenLieu.TenThuTuc);

    //cập nhật lại số lượng tồn trong kho
    //tính toán số lượng tồn
    await pool.request().query(`UPDATE ${checkIsNguyenLieu.TenBang}
        SET SoLuongTon = ${SoLuongTon - (SoLuongNhapCu - SoLuongNhapMoi)}
        WHERE ${checkIsNguyenLieu.TenCot} = ${ID}`);
  }
}

//hàm cập nhật chi tiết phiếu nhập sản phẩm thành phẩm
async function updateDetailFinishedProduct(IDPhieuNhap, item) {
  try {
    var ghiChu = null;
    if (item.GhiChu || item.GhiChu !== '') {
      ghiChu = item.GhiChu;
    }
    // lấy thông tin cũ
    const resultOld = await pool.request().query(`select IDDonViTinh,SoLuongNhap FROM ChiTietNhapSanPham WHERE IDSanPham = ${item.IDSanPham} AND IDPhieuNhap = ${IDPhieuNhap}`);
    const IDDonViCu = resultOld.recordset[0]['IDDonViTinh']
    const SoLuongNhapCu = resultOld.recordset[0]['SoLuongNhap']

    //lấy số lượng tồn trong kho
    const resultInventory = await pool.request().query(`select SoLuongTon FROM SanPham WHERE IDSanPham = ${item.IDSanPham}`);
    const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']
    //kiểm tra đơn vị tính mới có trùng với đơn vị tính mặc đinh không
    const resultCheckEqualUnitNew = await checkEqualUnit(item.IDDonViTinh, item.IDSanPham, false)
    // kiểm tra đơn vị tính cũ có trùng với đơn vị tính mặc đinh không
    const resultCheckEqualUnitOld = await checkEqualUnit(IDDonViCu, item.IDSanPham, false)
    //kiểm tra các trường hợp của đơn vị tính
    if (resultCheckEqualUnitNew && resultCheckEqualUnitOld) {//cả 2 đều trùng vơi đơn vị tính gốc
      console.log('TH1');
      // so sánh số lượng nhập
      CompareImported(item.SoLuongNhap, SoLuongNhapCu, IDPhieuNhap, item.IDSanPham, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, false)
    } else if (resultCheckEqualUnitNew && !resultCheckEqualUnitOld) {//mới trùng, cũ không
      console.log('TH2');
      //chuyển dvt cũ về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapCu = await ConvertUnit(SoLuongNhapCu, IDDonViCu, item.IDSanPham, false)
      // hai dvt đã bằng nhau và bằng mặc định
      // so sánh số lượng nhập
      CompareImported(item.SoLuongNhap, ConvertSoLuongNhapCu, IDPhieuNhap, item.IDSanPham, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, false)
    } else if (!resultCheckEqualUnitNew && resultCheckEqualUnitOld) {//mới không, cũ trùng
      console.log('TH3');
      //chuyển dvt mới về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapMoi = await ConvertUnit(item.SoLuongNhap, item.IDDonViTinh, item.IDSanPham, false)
      // hai dvt đã bằng nhau và bằng mặc định
      // so sánh số lượng nhập
      CompareImported2(ConvertSoLuongNhapMoi, SoLuongNhapCu, IDPhieuNhap, item.IDSanPham, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, item.SoLuongNhap, false)
    } else {//cả hai không trùng
      console.log('TH4');
      //chuyển cả 2 dvt về dạng đơn vị tính mặc định
      const ConvertSoLuongNhapCu = await ConvertUnit(SoLuongNhapCu, IDDonViCu, item.IDSanPham, false)
      const ConvertSoLuongNhapMoi = await ConvertUnit(item.SoLuongNhap, item.IDDonViTinh, item.IDSanPham, false)
      CompareImported2(ConvertSoLuongNhapMoi, ConvertSoLuongNhapCu, IDPhieuNhap, item.IDSanPham, item.IDDonViTinh, item.DonGiaNhap, ghiChu, SoLuongTon, item.SoLuongNhap, false)
    }
  } catch (error) {
    throw error;
  }
}
//hàm xoá chi tiết phiếu nhập nguyên liệu
async function deleteDetailIngredient(IDPhieuNhap, item) {
  try {
    //tính toán lại số lượng tồn
    //lấy số lượng tồn trong kho
    const resultInventory = await pool.request().query(`select SoLuongTon FROM NguyenLieu WHERE IDNguyenLieu = ${item.IDNguyenLieu}`);
    const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']

    // kiểm tra đơn vị tính có trùng với đơn vị tính mặc định không
    const resultCheckEqualUnit = await checkEqualUnit(item.IDDonViTinh, item.IDNguyenLieu, true)
    console.log('resultCheckEqualUnit', resultCheckEqualUnit);
    if (resultCheckEqualUnit) { //trùng với đơn vị tính mặc định
      console.log('trùng');
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
        .execute('inventory_updateReceipt_deleteDetailIngredient');
      //cập nhật số lượng tồn
      await pool.request().query(`UPDATE NguyenLieu
      SET SoLuongTon = ${SoLuongTon - item.SoLuongNhap}
      WHERE IDNguyenLieu = ${item.IDNguyenLieu}`);
    } else {
      console.log('không trùng');
      //chuyển về cùng đơn vị tính
      const ConvertSoLuongNhap = await ConvertUnit(item.SoLuongNhap, item.IDDonViTinh, item.IDNguyenLieu, 1)
      console.log('ConvertSoLuongNhap', ConvertSoLuongNhap);
      //xoá hàng dữ liệu
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
        .execute('inventory_updateReceipt_deleteDetailIngredient');
      //cập nhật số lượng tồn
      await pool.request().query(`UPDATE NguyenLieu
      SET SoLuongTon = ${SoLuongTon - ConvertSoLuongNhap}
      WHERE IDNguyenLieu = ${item.IDNguyenLieu}`);
    }

  } catch (error) {
    throw error;
  }
}
//hàm xoá chi tiết phiếu nhập sản phẩm thành phẩm
async function deleteDetailFinishedProduct(IDPhieuNhap, item) {
  try {
    //lấy số lượng tồn trong kho
    const resultInventory = await pool.request().query(`select SoLuongTon FROM SanPham WHERE IDSanPham= ${item.IDSanPham}`);
    const SoLuongTon = resultInventory.recordset[0]['SoLuongTon']

    // kiểm tra đơn vị tính có trùng với đơn vị tính mặc định không
    const resultCheckEqualUnit = await checkEqualUnit(item.IDDonViTinh, item.IDSanPham, false)
    console.log('resultCheckEqualUnit', resultCheckEqualUnit);
    if (resultCheckEqualUnit) { //trùng với đơn vị tính mặc định
      console.log('trùng');
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input('IDSanPham', sql.Int, item.IDSanPham)
        .execute('inventory_updateReceipt_deleteDetailFinishedProduct');
      //cập nhật số lượng tồn
      await pool.request().query(`UPDATE SanPham
      SET SoLuongTon = ${SoLuongTon - item.SoLuongNhap}
      WHERE IDSanPham = ${item.IDSanPham}`);
    } else {
      console.log('không trùng');
      //chuyển về cùng đơn vị tính
      const ConvertSoLuongNhap = await ConvertUnit(item.SoLuongNhap, item.IDDonViTinh, item.IDSanPham, false)
      console.log('ConvertSoLuongNhap', ConvertSoLuongNhap);
      //xoá hàng dữ liệu
      await pool.request()
        .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
        .input('IDSanPham', sql.Int, item.IDSanPham)
        .execute('inventory_updateReceipt_deleteDetailFinishedProduct');
      //cập nhật số lượng tồn
      await pool.request().query(`UPDATE SanPham
      SET SoLuongTon = ${SoLuongTon - ConvertSoLuongNhap}
      WHERE IDSanPham = ${item.IDSanPham}`);
    }
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
//Hàm xoá nguyên liệu
async function deleteIngredient(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .input('NameTable', sql.VarChar, 'NguyenLieu')
      .execute('global_deleteRowTable');
  } catch (error) {
    throw error;
  }
}
//xử lý thêm nguyên liệu
async function insertIngredient(data) {
  try {
    await pool.request()
      .input('TenNguyenLieu', sql.NVarChar, data.TenNguyenLieu)
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .execute('inventory_insertIngredient_insertIngredient');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
//xử lý cập nhật nguyên liệu
async function updateIngredient(data) {
  try {
    await pool.request()
      .input('IDNguyenLieu', sql.Int, data.IDNguyenLieu)
      .input('TenNguyenLieu', sql.NVarChar, data.TenNguyenLieu)
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .execute('inventory_updateIngredient_updateIngredient');
    return { success: true };
  } catch (error) {
    throw error;
  }
}


module.exports = {
  checkSessionAndRole: checkSessionAndRole,
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