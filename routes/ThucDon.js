var express = require('express');
const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();
const multer = require('multer');//upload
const path = require('path');//xử lý đường dẫn 
const sql = require("../handle/handleThucDon");//load file xử lý

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

router.get("/ThucDon", function (req, res, next) {
  res.render("index", { title: "Trang Thực Đơn" });
});

/*  Quản lý loại sản phẩm */
// Lấy danh sách loại sản phẩm
router.get("/getTypeProduct", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "TenLoaiSanPham"//giá trị mặc định cho cột sắp xếp
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
    // if (await sql.checkSessionAndRole(ss, 'getTypeProduct')) {
      let result = await sql.getTypeProduct();
      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter((row) => {
          const searchData = req.query.id;
          const searchBy = 'IDLoaiSanPham';
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
          const vietnameseColumns = ['TenLoaiSanPham'];

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
          if (sortBy === 'TenLoaiSanPham') {
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
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá loại sản phẩm
router.delete('/deleteTypeProduct', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteTypeProduct')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      for (const ID of IDs) {
        sql.deleteTypeProduct(ID)
          .catch(error => {
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
// Thêm loại sản phẩm
router.post('/insertTypeProduct', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertTypeProduct')) {
    if (req.body.TenLoaiSanPham) {
      sql.insertTypeProduct(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật loại sản phẩm
router.put('/updateTypeProduct', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateTypeProduct')) {
    if (req.body.IDLoaiSanPham && req.body.TenLoaiSanPham) {
      sql.updateTypeProduct(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

/*  Quản lý sản phẩm */
// Lấy danh sách toàn bộ sản phẩm (dùng cho menu chọn món)
router.get("/getProduct", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "IDSanPham"//giá trị mặc định cho cột sắp xếp
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
    // if (await sql.checkSessionAndRole(ss, 'getProduct')) {
      let result = await sql.getProduct();
      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const resultFilter = result.filter(item => item.IDSanPham == req.query.id);
        //lấy danh sách loại sản phẩm
        const resultGetList = await sql.getListTypeProductByIDProduct(req.query.id);
        //lấy danh sách định mức của sản phẩm
        const resultGetList2 = await sql.getListNormDetailsByIDProduct(req.query.id);
        const convert = resultGetList.map(item => {
          return item.IDLoaiSanPham;
        });
        // Lấy danh sách giá sản phẩm theo ID
        const resultGetList3 = await sql.getListPriceProductByID(req.query.id);
        //xử lý ngày tháng cho đúng định dạng
        const newResultGetList3 = resultGetList3.map(item => {
          const date = new Date(item.NgayApDung);
          return {
            ...item,
            NgayApDung: `${date.getDate() < 10 ? '0' + date.getDate() : date.getDate()
              }/${date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1
              }/${date.getFullYear()}`
          }
        })
        const newFilteredData = {
          ...resultFilter[0],
          IDLoaiSanPham: convert,
          DanhSach: resultGetList2,
          DanhSachGia: newResultGetList3
        };
        res.status(200).json(newFilteredData)
      }
      else {
        // tính năng lọc
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined' && req.query.searchBy === 'LoaiSanPham') {
          let resultGetProductByIDTypeProduct = await sql.getProductByIDTypeProduct(req.query.search);
          // Lấy danh sách IDSanPham
          const ids = resultGetProductByIDTypeProduct.map(item => item.IDSanPham);
          // Lọc mảng result
          result = result.filter(item => {
            return ids.includes(item.IDSanPham);
          });

        } else
          // tính năng tìm kiếm
          if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined' && req.query.searchBy !== 'LoaiSanPham') {
            // Danh sách các cột có dữ liệu tiếng Việt
            const vietnameseColumns = ['TenSanPham'];

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
                }//cột dữ liệu có cột khác string
                else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
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
          if (sortBy === 'TenSanPham') {
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
});
//Xoá sản phẩm
router.delete('/deleteProduct', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteProduct')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      for (const ID of IDs) {
        sql.deleteProduct(ID)
          .catch(error => {
            console.log(error, 'error');
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



//thêm sản phẩm thành phẩm
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'img/ThucDon/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});
const newupload = multer({ storage: storage });
router.post('/insertFinishedProduct', newupload.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  if (await sql.checkSessionAndRole(ss, 'insertProduct')) {
    if (req.body.TenSanPham && req.body.IDDonViTinh) {
      //kiểm tra có mô tả sản phẩm hay không
      var moTa = null;
      if (req.body.MoTa || req.body.MoTa !== '') {
        moTa = req.body.MoTa;
      }
      var iDLoaiSanPham = null
      if (req.body.IDLoaiSanPham != '') {
        iDLoaiSanPham = req.body.IDLoaiSanPham;
      }
      var giaBan = 0;
      if (req.body.GiaBan || req.body.GiaBan !== 0) {
        giaBan = req.body.GiaBan;
      }
      //nếu có hình ảnh thì lưu đường dẫn hình
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/ThucDon', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/ThucDon/${newPath}`;

        var data = {
          TenSanPham: req.body.TenSanPham,
          IDDonViTinh: req.body.IDDonViTinh,
          MoTa: moTa,
          IDLoaiSanPham: iDLoaiSanPham,
          SanPhamThanhPham: true,
          GiaBan: giaBan,
          HinhAnh: imagePathWithDomain
        };
      } else {
        var data = {
          TenSanPham: req.body.TenSanPham,
          IDDonViTinh: req.body.IDDonViTinh,
          MoTa: moTa,
          SanPhamThanhPham: true,
          GiaBan: giaBan,
          IDLoaiSanPham: iDLoaiSanPham
        };
      }


      sql.insertFinishedProduct(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: result.message });
          }
        })
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//sửa sản phẩm thành phẩm
router.put('/updateFinishedProduct', newupload.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  if (await sql.checkSessionAndRole(ss, 'updateProduct')) {
    if (req.body.IDSanPham && req.body.TenSanPham && req.body.IDDonViTinh) {
      //kiểm tra có mô tả sản phẩm hay không
      var moTa = null;
      if (req.body.MoTa || req.body.MoTa !== '') {
        moTa = req.body.MoTa;
      }
      var iDLoaiSanPham = null
      if (req.body.IDLoaiSanPham != '') {
        iDLoaiSanPham = req.body.IDLoaiSanPham;
      }
      var giaBan = 0;
      if (req.body.GiaBan || req.body.GiaBan !== 0) {
        giaBan = req.body.GiaBan;
      }
      //nếu có hình ảnh thì lưu đường dẫn hình
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/ThucDon', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/ThucDon/${newPath}`;

        var data = {
          IDSanPham: req.body.IDSanPham,
          TenSanPham: req.body.TenSanPham,
          IDDonViTinh: req.body.IDDonViTinh,
          MoTa: moTa,
          GiaBan: giaBan,
          IDLoaiSanPham: iDLoaiSanPham,
          HinhAnh: imagePathWithDomain
        };
      } else {
        if (req.body.HinhAnh)
          var data = {
            IDSanPham: req.body.IDSanPham,
            TenSanPham: req.body.TenSanPham,
            IDDonViTinh: req.body.IDDonViTinh,
            MoTa: moTa,
            GiaBan: giaBan,
            IDLoaiSanPham: iDLoaiSanPham,
            HinhAnh: req.body.HinhAnh
          };
        else
          var data = {
            IDSanPham: req.body.IDSanPham,
            TenSanPham: req.body.TenSanPham,
            IDDonViTinh: req.body.IDDonViTinh,
            MoTa: moTa,
            GiaBan: giaBan,
            IDLoaiSanPham: iDLoaiSanPham
          };
      }


      sql.updateFinishedProduct(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: result.message });
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
//thêm sản phẩm chế biến
router.post('/insertProcessedProduct', newupload.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  if (await sql.checkSessionAndRole(ss, 'insertProduct')) {
    if (req.body.TenSanPham && req.body.DanhSach.length > 0) {
      //kiểm tra có mô tả sản phẩm hay không
      var moTa = null;
      if (req.body.MoTa || req.body.MoTa !== '') {
        moTa = req.body.MoTa;
      }
      var iDLoaiSanPham = null
      if (req.body.IDLoaiSanPham != '') {
        iDLoaiSanPham = req.body.IDLoaiSanPham;
      }
      var giaBan = 0;
      if (req.body.GiaBan || req.body.GiaBan !== 0) {
        giaBan = req.body.GiaBan;
      }
      //nếu có hình ảnh thì lưu đường dẫn hình
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/ThucDon', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/ThucDon/${newPath}`;

        var data = {
          TenSanPham: req.body.TenSanPham,
          MoTa: moTa,
          IDLoaiSanPham: iDLoaiSanPham,
          SanPhamThanhPham: false,
          GiaBan: giaBan,
          DanhSach: req.body.DanhSach,
          HinhAnh: imagePathWithDomain
        };
      } else {
        var data = {
          TenSanPham: req.body.TenSanPham,
          IDDonViTinh: req.body.IDDonViTinh,
          MoTa: moTa,
          SanPhamThanhPham: false,
          GiaBan: giaBan,
          DanhSach: req.body.DanhSach,
          IDLoaiSanPham: iDLoaiSanPham
        };
      }

      sql.insertProcessedProduct(data)
        .then(() => {
          res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
        })
        .catch(error => {
          console.log("error", error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//sửa sản phẩm chế biến
router.put('/updateProcessedProduct', newupload.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  if (await sql.checkSessionAndRole(ss, 'updateProduct')) {
    if (req.body.IDSanPham && req.body.TenSanPham && req.body.DanhSach.length > 0) {
      //kiểm tra có mô tả sản phẩm hay không
      var moTa = null;
      if (req.body.MoTa || req.body.MoTa !== '') {
        moTa = req.body.MoTa;
      }
      var iDLoaiSanPham = null
      if (req.body.IDLoaiSanPham != '') {
        iDLoaiSanPham = req.body.IDLoaiSanPham;
      }
      var giaBan = 0;
      if (req.body.GiaBan || req.body.GiaBan !== 0) {
        giaBan = req.body.GiaBan;
      }
      //nếu có hình ảnh thì lưu đường dẫn hình
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/ThucDon', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/ThucDon/${newPath}`;

        var data = {
          IDSanPham: req.body.IDSanPham,
          TenSanPham: req.body.TenSanPham,
          IDDonViTinh: req.body.IDDonViTinh,
          MoTa: moTa,
          GiaBan: giaBan,
          IDLoaiSanPham: iDLoaiSanPham,
          DanhSach: req.body.DanhSach,
          HinhAnh: imagePathWithDomain
        };
      } else {
        if (req.body.HinhAnh)
          var data = {
            IDSanPham: req.body.IDSanPham,
            TenSanPham: req.body.TenSanPham,
            IDDonViTinh: req.body.IDDonViTinh,
            MoTa: moTa,
            GiaBan: giaBan,
            IDLoaiSanPham: iDLoaiSanPham,
            DanhSach: req.body.DanhSach,
            HinhAnh: req.body.HinhAnh
          };
        else
          var data = {
            IDSanPham: req.body.IDSanPham,
            TenSanPham: req.body.TenSanPham,
            IDDonViTinh: req.body.IDDonViTinh,
            DanhSach: req.body.DanhSach,
            MoTa: moTa,
            GiaBan: giaBan,
            IDLoaiSanPham: iDLoaiSanPham
          };
      }


      sql.updateProcessedProduct(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: result.message });
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