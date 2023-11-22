var express = require('express');

const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();
const multer = require('multer');//upload
const upload = multer({ dest: 'uploads/' });//upload
const xlsx = require('node-xlsx');
const moment = require('moment');
const momenttz = require('moment-timezone');
const path = require('path');//xử lý đường dẫn 

const sql = require("../dboperation");//load file dboperation

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



router.get("/", function (req, res, next) {
  res.render("index", { title: "VRes" });
});

//hàm đăng nhâp
router.post("/login", function (req, res, next) {
  const data = req.body;
  console.log(req.body);
  try {
    sql
      .login(data, res)
      .then((result) => {
        if (result.success) {
          res.status(200).json(result);
        } else {
          res.status(401).json(result);
        }
      })
  }
  catch (error) {
    console.log("Lỗi đăng nhập không thành công: " + error);
    let errorMessage = "Lỗi đăng nhập không thành công.";
    if (error.message) {
      errorMessage = error.message;
    }
    res.status(500).json({ message: 'Lỗi đăng nhập không thành công: ', errorMessage });
  }
});

//hàm kiểm tra phiên làm việc:

router.post("/session", function (req, res, next) {
  const data = req.body;
  try {
    sql
      .session(data)
      .then((result) => {
        if (result.success) {
          res.status(200).json(result);
        } else {
          res.status(401).json(result);
        }
      })
  } catch (error) {
    console.log("Lỗi đăng nhập không thành công: " + error);
    let errorMessage = "Lỗi đăng nhập không thành công.";
    if (error.message) {
      errorMessage = error.message;
    }
    res.status(500).json({ message: 'Lỗi đăng nhập không thành công: ', errorMessage });
  }
});

//Đăng xuất tài khoản
router.get("/logout", async function (req, res, next) {
  const ss = req.headers.ss;
  try {
    const result = await sql.logout(ss);
    if (result.success) {
      res.status(200).json(
        result.message
      );
    } else {
      res.status(401).json(
        result.message
      );
    }
  } catch (error) {
    console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
    res.status(500).json({ message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

//tải dữ liệu tài khoản
router.get("/getAccount", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "IDNhanVien"//giá trị mặc định cho cột sắp xếp
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
    if (await sql.checkSessionAndRole(ss, 'getAccount')) {
      let result = await sql.getAccount();
      //kiểm tra chức năng lấy 1 tài khoản
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        console.log('vào bước 2');
        const filteredData = result.filter((row) => {
          const searchData = req.query.id;
          const searchBy = 'IDNhanVien';
          // Lấy giá trị cột tìm kiếm
          const columnData = row[searchBy];
          const stringColumnData = String(columnData);
          const lowerCaseColumnData = stringColumnData.toLowerCase();
          const lowerCaseSearchData = searchData.toLowerCase();
          return lowerCaseColumnData.includes(lowerCaseSearchData);
        })
        let resultgetRoleAccountByID = await sql.getRoleAccountByID(req.query.id);
        const convertIDRoleAccount = resultgetRoleAccountByID.map(item => {
          return item.IDVaiTro;
        });

        const newFilteredData = {
          ...filteredData[0],
          IDVaiTro: convertIDRoleAccount
        };
        res.status(200).json(newFilteredData)
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TenNhanVien', 'TenVaiTro', 'TenViTriCongViec'];

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
          if (sortBy === 'TenNhanVien' || sortBy === 'TenVaiTro' || sortBy === 'TenViTriCongViec') {
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


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});


//thêm dữ liệu tài khoản
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'img/NhanVien/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});

const newupload = multer({ storage: storage });

router.post('/insertAccount', newupload.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  //nếu có hình ảnh thì lưu đường dẫn hình
  if (req.file) {
    imagePath = req.file.path
    const domain = req.headers.host;
    const newPath = imagePath ? path.relative('img/NhanVien', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
    const imagePathWithDomain = `http://${domain}/NhanVien/${newPath}`;
    var data = {
      TenNhanVien: req.body.TenNhanVien,
      IDViTriCongViec: req.body.IDViTriCongViec,
      TaiKhoan: req.body.TaiKhoan,
      MatKhau: req.body.MatKhau,
      NgaySinh: req.body.NgaySinh,
      GioiTinh: req.body.GioiTinh,
      DiaChi: req.body.DiaChi,
      SoDienThoai: req.body.SoDienThoai,
      TinhTrang: req.body.TinhTrang,
      NgayVao: req.body.NgayVao,
      IDVaiTro: req.body.IDVaiTro,
      HinhAnh: imagePathWithDomain
    };
  } else {
    var data = {
      TenNhanVien: req.body.TenNhanVien,
      IDViTriCongViec: req.body.IDViTriCongViec,
      TaiKhoan: req.body.TaiKhoan,
      MatKhau: req.body.MatKhau,
      NgaySinh: req.body.NgaySinh,
      GioiTinh: req.body.GioiTinh,
      DiaChi: req.body.DiaChi,
      SoDienThoai: req.body.SoDienThoai,
      TinhTrang: req.body.TinhTrang,
      NgayVao: req.body.NgayVao,
      IDVaiTro: req.body.IDVaiTro
    };
  }


  if (await sql.checkSessionAndRole(ss, 'insertAccount')) {
    sql.insertAccount(data)
      .then(result => {
        if (result.success) {
          res.status(200).json({ success: true, message: result.message });
        }
      })
      .catch(error => {
        console.log("Lỗi khi thêm dữ liệu tài khoản: " + error);
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
      });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

// tải danh sách vai trò và id vai trò
router.get("/getRole", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'getRole')) {
      let result = await sql.getRole();
      res.status(200).json(result);
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

// tải danh sách vị trí công việc
router.get("/getJobPosition", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'getJobPosition')) {
      let result = await sql.getJobPosition();
      res.status(200).json(result);
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});





//Cập nhật tài khoản
router.put('/updateAccount', newupload.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  //nếu có hình ảnh thì lưu đường dẫn hình
  if (req.file) {
    imagePath = req.file.path
    const domain = req.headers.host;
    const newPath = imagePath ? path.relative('img/NhanVien', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
    const imagePathWithDomain = `http://${domain}/NhanVien/${newPath}`;
    var data = {
      IDNhanVien: req.body.IDNhanVien,
      TenNhanVien: req.body.TenNhanVien,
      IDViTriCongViec: req.body.IDViTriCongViec,
      TaiKhoan: req.body.TaiKhoan,
      MatKhau: req.body.MatKhau,
      NgaySinh: req.body.NgaySinh,
      GioiTinh: req.body.GioiTinh,
      DiaChi: req.body.DiaChi,
      SoDienThoai: req.body.SoDienThoai,
      TinhTrang: req.body.TinhTrang,
      NgayVao: req.body.NgayVao,
      IDVaiTro: req.body.IDVaiTro,
      HinhAnh: imagePathWithDomain
    };
  } else {
    if (req.body.HinhAnh)
      var data = {
        IDNhanVien: req.body.IDNhanVien,
        TenNhanVien: req.body.TenNhanVien,
        IDViTriCongViec: req.body.IDViTriCongViec,
        TaiKhoan: req.body.TaiKhoan,
        MatKhau: req.body.MatKhau,
        NgaySinh: req.body.NgaySinh,
        GioiTinh: req.body.GioiTinh,
        DiaChi: req.body.DiaChi,
        SoDienThoai: req.body.SoDienThoai,
        TinhTrang: req.body.TinhTrang,
        NgayVao: req.body.NgayVao,
        IDVaiTro: req.body.IDVaiTro,
        HinhAnh: req.body.HinhAnh
      };
    else
      var data = {
        IDNhanVien: req.body.IDNhanVien,
        TenNhanVien: req.body.TenNhanVien,
        IDViTriCongViec: req.body.IDViTriCongViec,
        TaiKhoan: req.body.TaiKhoan,
        MatKhau: req.body.MatKhau,
        NgaySinh: req.body.NgaySinh,
        GioiTinh: req.body.GioiTinh,
        DiaChi: req.body.DiaChi,
        SoDienThoai: req.body.SoDienThoai,
        TinhTrang: req.body.TinhTrang,
        NgayVao: req.body.NgayVao,
        IDVaiTro: req.body.IDVaiTro
      };
  }


  if (await sql.checkSessionAndRole(ss, 'updateAccount')) {
    sql.updateAccount(data)
      .then(result => {
        if (result.success) {
          res.status(200).json({ success: true, message: result.message });
        }
      })
      .catch(error => {
        console.log("Lỗi khi cập nhật tài khoản: " + error);
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
      });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});


//Xoá tài khoản
let deletedData = [];
router.delete('/deleteAccount', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteAccount')) {
    for (const ID of IDs) {
      sql.deleteAccount(ID)
        .then(result => {
          if (result.success) {
            deletedData.push(ID);
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    }
    res.status(200).json({ success: true, deletedData, message: "Xoá Dữ Liệu Thành Công!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});

// Hàm khôi phục hành động xoá
router.post('/undoDelete', async function (req, res, next) {
  const ss = req.headers.ss;
  if (await sql.checkSessionAndRole(ss, 'deleteAccount')) {
    if (deletedData && deletedData.length > 0) {
      const promises = deletedData.map((ID) => {
        return sql.undoDelete(ID, ss)
      });
      try {
        Promise.all(promises)
          .then(() => {
            res.json("Undo thành công");
          })
          .finally(() => {
            deletedData = [];
          });
      }
      catch (error) {
        console.log("Lỗi không undo được dữ liệu: " + error);
        let errorMessage = "Có lỗi xảy ra khi undo dữ liệu.";
        if (error.message) {
          errorMessage = error.message;
        }
        res.status(500).json({ message: 'Lỗi không undo được dữ liệu', errorMessage });
      }

    } else {
      res.status(400).json({ error: "Không có dữ liệu undo" });
    }
  }
});









//tìm kiếm data
router.get('/search/:Search/:ColumnName', function (req, res, next) {
  try {
    const Search = req.params.Search;
    const columnName = req.params.ColumnName;
    const encodedSearch = encodeURIComponent(Search); // Mã hóa chuỗi tìm kiếm( mã hoá cả tiếng Việt)

    sql.searchData(encodedSearch, columnName).then((result) => {//gọi hàm searchData
      res.status(200).json(result);
    }).catch((error) => {
      console.log(error);
    });;

  } catch (error) {
    console.log("Error: " + error.message);
    res.sendStatus(500);
  }
});

// Lấy dữ liệu từ bảng khách hàng để tạo combobox:
router.get('/getdataMaKHTenKHFromKhachHang', function (req, res, next) {
  // Thực hiện truy vấn để lấy thông tin record trong bảng HoaDon
  sql.getMaKHTenKHCustomers().then((result) => {
    res.json(result);
  });
});

router.get('/getdataMaNVHoNVTenNVFromNhanVien', function (req, res, next) {
  // Thực hiện truy vấn để lấy thông tin record trong bảng HoaDon
  sql.getMaNVHoNVTenNVNhanVien().then((result) => {
    res.json(result);
  });
});


//Nhập file 
const { log } = require('console');
const { setSeconds } = require('date-fns/fp');
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/'); // Thư mục lưu trữ file
//   },
//   filename: function (req, file, cb) {
//     const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
//     cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
//   }
// });
// const newupload = multer({ storage: storage });

//Nhập file 
router.post('/importdata', newupload.single('file'), async (req, res, next) => {
  var alertImport = '';
  var errorImport = [];
  // Read file data
  const workSheetsFromFile = xlsx.parse(req.file.path);
  console.log(workSheetsFromFile);
  // Đảm bảo biến workSheetsFromFile chứa bảng tính dữ liệu
  if (!Array.isArray(workSheetsFromFile) || workSheetsFromFile.length === 0 || !Array.isArray(workSheetsFromFile[0].data)) {
    return res.status(400).json({ error: 'Không tìm thấy dữ liệu trong file Excel' });
  }

  const worksheet = workSheetsFromFile[0].data;
  const data = Object.create(null);
  let results = [];

  for (let i = 0; i < worksheet.length; i++) {
    // Kiểm tra định dạng ngày tháng
    const test1 = new Date((worksheet[i][0] - 25569) * 86400 * 1000);
    const isValidDate = moment(test1).isValid();
    const test2 = new Date((worksheet[i][1] - 25569) * 86400 * 1000);
    const isValidDate2 = moment(test2).isValid();
    if (!isValidDate) {
      errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: A" + (i + 1));
    } else if (!isValidDate2) {
      errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: B" + (i + 1));
    } else if (!Number.isInteger(worksheet[i][2])) {
      errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: C" + (i + 1));
    } else if (!Number.isInteger(worksheet[i][3])) {
      errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: D" + (i + 1));
    } else {
      try {
        const NgayHD = momenttz.tz(new Date((worksheet[i][0] - 25569) * 86400 * 1000), 'Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSSZ');
        const NgayGiao = momenttz.tz(new Date((worksheet[i][1] - 25569) * 86400 * 1000), 'Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSSZ');
        if (/[*&^%$#@!()<>\[\]{}| ]/.test(worksheet[i][0]) && !/[/_\-\\]/.test(worksheet[i][0])) {
          errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: A" + (i + 1));
        } else if (/[*&^%$#@!()<>\[\]{}| ]/.test(worksheet[i][1]) && !/[/_\-\\]/.test(worksheet[i][1])) {
          errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: B" + (i + 1));
        } else {
          const MaKH = String(worksheet[i][2]);
          const MaNV = String(worksheet[i][3]);
          data.NgayHD = NgayHD;
          data.NgayGiao = NgayGiao;
          data.MaKH = MaKH;
          data.MaNV = MaNV;
          console.log(data);
          if (data.NgayHD === 'Invalid date') {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: A" + (i + 1));
          } else if (data.NgayGiao === 'Invalid date') {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: B" + (i + 1));
          } else {
            const result = await sql.insert_data(data);
            results.push(result);
            if (i == 0) {
              alertImport = alertImport + (i + 1);
            } else {
              alertImport = alertImport + `ㅤ` + (i + 1);
            }


          }

        }
      } catch (error) {
        // Xử lý lỗi khi insert_data() trả về lỗi
        console.log(error);
        return res.status(500).json({ error: 'Đã xảy ra lỗi khi lưu dữ liệu vào cơ sở dữ liệu' });
      }
    }
  }

  return res.status(200).json({ success: alertImport, errorImport: errorImport });

});

//Sửa hàng loạt
router.get("/getDataSelected", function (req, res, next) {
  const { recordIds } = req.query;
  sql.getDataSelected(recordIds).then((result) => {
    res.json(result);
  });
});
router.put('/updateDataSelected', function (req, res, next) {
  const SoHDs = req.body.SoHDs; // Mảng SoHD
  const data = req.body.data; // Mảng dữ liệu đã sửa đổi
  var alertImport = '';
  var errorImport = [];
  var dataedit = Object.create(null);
  for (let i = 0; i < SoHDs.length; i++) {
    const SoHD = SoHDs[i];
    const rowData = data[i];

    var momentDate = moment(rowData.NgayHD, "DD-MM-YYYY");
    var momentDate2 = moment(rowData.NgayGiao, "DD-MM-YYYY");

    if (!momentDate.isValid()) {
      // xử lý khi đối tượng Moment không biểu diễn một ngày hợp lệ
      errorImport.push('Lỗi tại hàng dữ liệu có Số Hoá Đơn là:  ' + rowData.SoHD + "  . Cột Ngày Hoá Đơn");
    } else if (!momentDate2.isValid()) {
      // xử lý khi đối tượng Moment không biểu diễn một ngày hợp lệ
      errorImport.push('Lỗi tại hàng dữ liệu có Số Hoá Đơn là:  ' + rowData.SoHD + "  . Cột Ngày Giao");
    } else if (isNaN(rowData.MaKH)) {
      errorImport.push('Lỗi tại hàng dữ liệu có Số Hoá Đơn là:  ' + rowData.SoHD + "  . Cột Mã Khách Hàng");
    } else if (isNaN(rowData.MaNV)) {
      errorImport.push('Lỗi tại hàng dữ liệu có Số Hoá Đơn là:  ' + rowData.SoHD + "  . Cột Mã Nhân Viên");
    } else {
      var parts = rowData.NgayHD.split("-"); // tách chuỗi thành mảng các phần tử
      var year = parts[2]; // lấy năm từ phần tử thứ 3
      var month = parts[1]; // lấy tháng từ phần tử thứ 2
      var day = parts[0]; // lấy ngày từ phần tử thứ 1
      var formattedDate = year + "-" + month + "-" + day; // ghép chuỗi thành định dạng yyyy-mm-dd
      dataedit.NgayHD = formattedDate

      parts = rowData.NgayGiao.split("-"); // tách chuỗi thành mảng các phần tử
      year = parts[2]; // lấy năm từ phần tử thứ 3
      month = parts[1]; // lấy tháng từ phần tử thứ 2
      day = parts[0]; // lấy ngày từ phần tử thứ 1
      formattedDate = year + "-" + month + "-" + day; // ghép chuỗi thành định dạng yyyy-mm-dd
      dataedit.NgayGiao = formattedDate;
      dataedit.MaKH = rowData.MaKH;
      dataedit.MaNV = rowData.MaNV;
      sql.update_data(SoHD, dataedit).then((result) => {
      }).catch((error) => {
        res.status(500).send(`Có lỗi khi cập nhật dữ liệu cho SoHD ${SoHD}: ${error}`);
      });
      if (i == 0) {
        alertImport = alertImport + ` ${rowData.SoHD}`;
      } else {
        alertImport = alertImport + `ㅤ${rowData.SoHD}`;
      }

    }

  }
  return res.status(200).json({ success: alertImport, errorImport: errorImport });
});




module.exports = router;
