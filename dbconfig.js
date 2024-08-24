//connect sử dụng  windows Authentication
// const config = {
//     server: "THANHMIXED\\SQLEXPRESS",
//     database: "HoaDon",
//     options: {
//       trustedconnection: true,
//       enableArithAbort: true,
//       authentication: {
//         type: "ActiveDirectoryIntegrated"
//       }
//     }
//   };


//connect sử dụng  sql server Authentication
// const config = {
//     user: "admin",
//     password: "12345",
//     server: "THANHMIXED",
//     database: "NhaHang",
//     options: {
//       trustedconnection: true,
//       trustServerCertificate: true,
//       enableArithAbort: true,
//       instancename: "",
//     },
//     port: 2651
//      //tìm port bằng cách truy cập sql server configuration manager trong máy -> sql server network configuration -> Protocols for SQLEXPRESS -> Enabled phần TCP/IP ->TCP/IP -> IP Adress-> IPAll ->lấy thông số TCP Dynamic Port
//   };

// require('dotenv').config();
//   const config = {
//     user: "UserQuanLyNhaHangCafe",
//     password: "X0p5B4M55CtV",
//     server: "118.69.126.49",
//     database: "Data_QuanLyNhaHangCafe",
//     options: {
//       trustedconnection: true,
//       trustServerCertificate: true,
//       enableArithAbort: true,
//       instancename: "",
//     },
//     port: 1433
//      //tìm port bằng cách truy cập sql server configuration manager trong máy -> sql server network configuration -> Protocols for SQLEXPRESS -> Enabled phần TCP/IP ->TCP/IP -> IP Adress-> IPAll ->lấy thông số TCP Dynamic Port
//   };
const sql = require('mssql');
require('dotenv').config();
const config = {
  user: process.env.user,
  password: process.env.password,
  server: process.env.server,
  database: process.env.database,
  options: {
    trustedconnection: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    instancename: "",
  },
  port: 1433
};

let pool;

async function connect() {
  pool = new sql.ConnectionPool(config);
  await pool.connect();
  //console.log('\x1b[42m Nhớ xoá dữ liệu DaXoa = 1 trong các bảng phụ như Chi tiết định mức \x1b[0m')
  console.log('\x1b[32m Đã kết nối tới Cơ Sở Dữ Liệu __________________________________________________________________________________________\x1b[0m');
}

connect();

module.exports = {
  getPool: () => {
    return pool;
  }
}

