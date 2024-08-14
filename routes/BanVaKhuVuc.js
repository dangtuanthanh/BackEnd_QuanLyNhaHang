var express = require('express');
const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();

const sql = require("../handle/handleBanVaKhuVuc");//load file xử lý

// Middleware kiểm tra và xác thực tên miền truy cập
// const checkDomainAccess = (allowedDomains) => {
//   return (req, res, next) => {
//     const domain = req.headers.origin;
//     if (allowedDomains.includes(domain)) {
//       next();
//     } else {
//       res.status(403).send('Forbidden');
//     }
//   };
// };
// app.use(checkDomainAccess(['https://your-allowed-domain.com']));

//cấu hình cors


router.use(bodyParser.json());//cho phép xử lý dữ liệu gửi lên dạng json
router.use(bodyParser.urlencoded({ extended: false }));//cho phép xử lý dữ liệu gửi lên dạng application/x-www-form-urlencoded

router.get("/BanVaKhuVuc", function (req, res, next) {
  res.render("index", { title: "Trang Bàn Và Khu Vực" });
});

/*  Quản lý bàn và khu vực */
// Lấy danh sách khu vực
router.get("/getArea", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const iddoitac = req.headers.iddoitac;
  if (req.headers.iddoitac) {
    const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
    var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
    var sortBy = "IDKhuVuc"//giá trị mặc định cho cột sắp xếp
    var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
    var searchExact = false//giá trị mặc định cho chế độ sắp xếp
    if (typeof req.query.sortBy !== 'undefined') {
      sortBy = req.query.sortBy
    }
    if (typeof req.query.sortOrder !== 'undefined') {
      sortOrder = req.query.sortOrder
    }
    if (typeof req.query.searchExact !== 'undefined') {
      if (req.query.searchExact === 'true') searchExact = true;
      else searchExact = false

    }
    //xử lý yêu cầu
    // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    try {
      // if (await sql.checkSessionAndRole(ss, 'getArea')) {

      let result = await sql.getArea(iddoitac);
      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter((row) => {
          const searchData = req.query.id;
          const searchBy = 'IDKhuVuc';
          // Lấy giá trị cột tìm kiếm
          const columnData = row[searchBy];
          const stringColumnData = String(columnData);
          const lowerCaseColumnData = stringColumnData.toLowerCase();
          const lowerCaseSearchData = searchData.toLowerCase();
          return lowerCaseColumnData.includes(lowerCaseSearchData);
        })
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TenKhuVuc'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'TenKhuVuc') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });
        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }
        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }
      // } else {
      //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
      // }
    } catch (error) {
      console.log('error', error);
      res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
    }
  }
  else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
});
//Xoá khu vực
router.delete('/deleteArea', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteArea')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      for (const ID of IDs) {
        sql.deleteArea(IDDoiTac, ID)
          .catch(error => {
            console.log('error', error);
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});
// Thêm khu vực
router.post('/insertArea', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertArea')) {
    if (req.body.TenKhuVuc) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      sql.insertArea(IDDoiTac, data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log('error', error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật khu vực
router.put('/updateArea', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateArea')) {
    if (req.body.TenKhuVuc && req.body.IDKhuVuc) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      sql.updateArea(IDDoiTac, data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log('error', error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

/* Quản lý bàn */
//tải danh sách bàn
router.get("/getTable", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const iddoitac = req.headers.iddoitac;
  if (req.headers.iddoitac) {
    const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
    var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
    var sortBy = "IDBan"//giá trị mặc định cho cột sắp xếp
    var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
    var searchExact = false//giá trị mặc định cho chế độ sắp xếp
    if (typeof req.query.sortBy !== 'undefined') {
      sortBy = req.query.sortBy
    }
    if (typeof req.query.sortOrder !== 'undefined') {
      sortOrder = req.query.sortOrder
    }
    if (typeof req.query.searchExact !== 'undefined') {
      if (req.query.searchExact === 'true') searchExact = true;
      else searchExact = false

    }
    //xử lý yêu cầu
    // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    try {
      // if (await sql.checkSessionAndRole(ss, 'getTable')) {
      let result = await sql.getTable(iddoitac);
      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter((row) => {
          const searchData = req.query.id;
          const searchBy = 'IDBan';
          // Lấy giá trị cột tìm kiếm
          const columnData = row[searchBy];
          const stringColumnData = String(columnData);
          const lowerCaseColumnData = stringColumnData.toLowerCase();
          const lowerCaseSearchData = searchData.toLowerCase();
          return lowerCaseColumnData.includes(lowerCaseSearchData);
        })
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TenBan', 'TrangThai', 'TenKhuVuc'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        // Sắp xếp
        result.sort((a, b) => {
          if (sortBy === 'TenBan') {
            // Tách số ra khỏi tên bàn và sắp xếp theo số nếu có
            const extractNumber = (str) => {
              const match = str.match(/\d+/);
              return match ? parseInt(match[0], 10) : Infinity; // Nếu không có số thì đặt số lớn nhất
            };

            const numA = extractNumber(a.TenBan);
            const numB = extractNumber(b.TenBan);

            if (numA !== numB) {
              return sortOrder === 'asc' ? numA - numB : numB - numA;
            }

            // Nếu số giống nhau hoặc không có số thì sắp xếp theo tên
            const comparison = a.TenBan.localeCompare(b.TenBan, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else if (sortBy === 'TrangThai' || sortBy === 'TenKhuVuc') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else { // Cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });

        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }
        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }
      // } else {
      //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
      // }
    } catch (error) {
      console.log('error', error);
      res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
    }
  }
  else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
});
//Xoá bàn
router.delete('/deleteTable', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteTable')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      for (const ID of IDs) {
        sql.deleteTable(IDDoiTac, ID)
          .catch(error => {
            console.log('error', error);
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});
// Thêm bàn
router.post('/insertTable', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertTable')) {
    if (req.body.TenBan && req.body.TrangThai && req.body.IDKhuVuc) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      sql.insertTable(IDDoiTac, data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log('error', error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật bàn
router.put('/updateTable', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateTable')) {
    if (req.body.IDBan && req.body.TenBan && req.body.TrangThai && req.body.IDKhuVuc) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      sql.updateTable(IDDoiTac, data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log('error', error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

module.exports = router;