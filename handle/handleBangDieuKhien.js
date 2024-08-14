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

//xử lý lấy số lượng bàn ăn đang hoạt động
async function getOccupiedTables(IDDoiTac) {
  try {
    let result = await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .execute('dashboard_getOccupiedTables');
    return result.recordset.length;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy số lượng hoá đơn hôm nay
async function getInvoiceToday(IDDoiTac) {
  try {
    // Lấy ngày hiện tại
    const date = new Date();
    let result = await pool.request()
      .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('date', sql.Date, date)
      .execute('dashboard_getInvoiceToday');
    return result.recordset.length;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy số lượng doanh thu hôm nay
async function getRevenueToday(IDDoiTac) {
  try {
    // Lấy ngày hiện tại
    const date = new Date();
    let result = await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('date', sql.Date, date)
      .execute('dashboard_getRevenueToday');
    return result.recordset[0].TotalRevenue;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy số lượng doanh thu tháng
async function getRevenueMonth(IDDoiTac) {
  try {
    // Lấy ngày hiện tại
    const date = new Date();
    date.setDate(1);
    let result = await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('date', sql.Date, date)
      .execute('dashboard_getRevenueMonth');
    return result.recordset[0].TotalRevenue;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy số lượng doanh thu tháng
async function getListRevenueMonth(IDDoiTac) {

  try {

    const date = new Date();

    const currentMonth = {
      month: date.getMonth() + 1,
      year: date.getFullYear()
    };

    const previousMonth = {
      month: date.getMonth(),
      year: date.getFullYear()
    };

    if (previousMonth.month === 0) {
      previousMonth.month = 12;
      previousMonth.year -= 1;
    }
    const result = await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('month', currentMonth.month)
      .input('year', currentMonth.year)
      .execute('dashboard_getListRevenueMonth');
    const result2 = await pool.request()
    .input("IDDoiTac", sql.UniqueIdentifier, IDDoiTac)
      .input('month', previousMonth.month)
      .input('year', previousMonth.year)
      .execute('dashboard_getListRevenueMonth');
    const currentData = formatData(result.recordset, currentMonth.month, currentMonth.year);
    const previousData = formatData(result2.recordset, previousMonth.month, previousMonth.year);

    return {
      current: currentData,
      previous: previousData
    }


  } catch (error) {
    throw error;
  }
}
function getDaysInMonth(month, year) {
  return Array.from(
    { length: new Date(year, month, 0).getDate() },
    (_, i) => i + 1
  );
}
function formatData(records, month, year) {
  const daysInMonth = getDaysInMonth(month, year);

  let processedData = [];

  daysInMonth.forEach(day => {
    let record = records.find(r => r.Day === day);

    if (record) {
      processedData.push({
        Day: day,
        Revenue: record.Revenue
      });
    } else {
      processedData.push({
        Day: day,
        Revenue: 0
      });
    }
  });

  return processedData;

}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getIDDoiTac: getIDDoiTac,
  getOccupiedTables: getOccupiedTables,
  getInvoiceToday: getInvoiceToday,
  getRevenueToday: getRevenueToday,
  getRevenueMonth: getRevenueMonth,
  getListRevenueMonth: getListRevenueMonth
};