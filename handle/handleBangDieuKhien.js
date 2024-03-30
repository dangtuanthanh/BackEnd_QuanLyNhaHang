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
//xử lý lấy số lượng bàn ăn đang hoạt động
async function getOccupiedTables() {
  try {
    let result = await pool.request().query('EXEC dashboard_getOccupiedTables');
    return result.recordset.length;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy số lượng hoá đơn hôm nay
async function getInvoiceToday() {
  try {
    // Lấy ngày hiện tại
    const date = new Date();
    let result = await pool.request()
      .input('date', sql.Date, date)
      .query('EXEC dashboard_getInvoiceToday @date');
    return result.recordset.length;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy số lượng doanh thu hôm nay
async function getRevenueToday() {
  try {
    // Lấy ngày hiện tại
    const date = new Date();
    let result = await pool.request()
      .input('date', sql.Date, date)
      .query('EXEC dashboard_getRevenueToday @date');
    return result.recordset[0].TotalRevenue;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy số lượng doanh thu tháng
async function getRevenueMonth() {
  try {
    // Lấy ngày hiện tại
    const date = new Date();
    date.setDate(1);
    let result = await pool.request()
      .input('date', sql.Date, date)
      .query('EXEC dashboard_getRevenueMonth @date');
    return result.recordset[0].TotalRevenue;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy số lượng doanh thu tháng
async function getListRevenueMonth() {

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
      .input('month', currentMonth.month)
      .input('year', currentMonth.year)
      .execute('dashboard_getListRevenueMonth');
    const result2 = await pool.request()
      .input('month', previousMonth.month)
      .input('year', previousMonth.year)
      .execute('dashboard_getListRevenueMonth');
      const currentData = formatData(result.recordset,currentMonth.month,currentMonth.year);
      const previousData = formatData(result2.recordset,previousMonth.month,previousMonth.year);
    
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
    {length: new Date(year, month, 0).getDate()}, 
    (_, i) => i + 1
  );
}
function formatData(records,month,year) {
  const daysInMonth = getDaysInMonth(month, year);

  let processedData = [];

  daysInMonth.forEach(day => {
    let record = records.find(r => r.Day === day);

    if(record) {
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
  getOccupiedTables: getOccupiedTables,
  getInvoiceToday: getInvoiceToday,
  getRevenueToday: getRevenueToday,
  getRevenueMonth: getRevenueMonth,
  getListRevenueMonth: getListRevenueMonth
};