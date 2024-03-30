var express = require('express');
const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();
const multer = require('multer');//upload
const xlsx = require('node-xlsx');
const moment = require('moment');
const path = require('path');//xử lý đường dẫn 

const sql = require("../handle/handleIndex");//load file dboperation

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
// hệ thống
//hàm đăng nhâp
router.post("/login", function (req, res, next) {
  const data = req.body;
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
    res.status(500).json({ message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//thay đổi mật khẩu:

router.post("/changePassword", async function (req, res, next) {
  try {
    const ss = req.headers.ss;
    if (req.headers.ss) {
      if (req.body.MatKhauCu && req.body.MatKhauMoi) {
        const resultChangePassword = await sql.changePassword(ss, req.body.MatKhauCu, req.body.MatKhauMoi)
        if (resultChangePassword.success) {
          res.status(200).json({ success: true, message: "Đổi Mật Khẩu Thành Công!" });
        } else {
          res.status(500).json({ success: false, message: resultChangePassword.message });
        }
      } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác !" });
    } else res.status(401).json({ success: false, message: "Đăng nhập đã hết hạn !" });
  } catch (error) {
    console.log('error',error);
    res.status(500).json({ success: false, message: error });
  }


});


/*Quản lý nhân viên */
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
        let resultgetRoleAccountByID = await sql.getListRoleByIDAccount(req.query.id);
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
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
      });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
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
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
      });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Xoá tài khoản

router.delete('/deleteAccount', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteAccount')) {
    for (const ID of IDs) {
      sql.deleteAccount(ID)
        .then(result => {
          if (result.success) {
          }
        })
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    }
    res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});
// Hàm khôi phục hành động xoá
router.post('/undoDeleteAccount', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.undoDelete;
  if (await sql.checkSessionAndRole(ss, 'deleteAccount')) {
    if (IDs && IDs.length > 0) {
      const promises = IDs.map((ID) => {
        return sql.undoDeleteAccount(ID)
      });
      Promise.all(promises)
        .then(() => {
          res.status(200).json({ message: "Undo thành công" });
        })
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else {
      res.status(400).json({ message: "Không có dữ liệu undo" });
    }
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

//Nhập file 
const storageExcelAccount = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/excel/NhanVien/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});

const uploadExcelAccount = multer({ storage: storageExcelAccount });

//Nhập file 
router.post('/importExcelAccount', uploadExcelAccount.single('file'), async (req, res, next) => {
  const ss = req.headers.ss;
  //kiểm tra quyền và phiên đăng nhập
  if (await sql.checkSessionAndRole(ss, 'insertAccount')) {
    //kiểm tra sự tồn tại của file
    if (req.file) {
      const allowedMimeTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      //kiểm tra file gửi lên có phải excel hay không
      if (allowedMimeTypes.includes(req.file.mimetype)) {
        let alertImport = '';
        let errorImport = [];
        // Read file data
        const workSheetsFromFile = xlsx.parse(req.file.path);
        // Đảm bảo biến workSheetsFromFile chứa bảng tính dữ liệu
        if (!Array.isArray(workSheetsFromFile) || workSheetsFromFile.length === 0 || !Array.isArray(workSheetsFromFile[0].data)) {
          return res.status(400).json({ error: 'Không tìm thấy dữ liệu trong file Excel' });
        }

        const worksheet = workSheetsFromFile[0].data;
        //const data = Object.create(null);
        let results = [];
        //số dòng tối đa trong file excel đã nhập 
        const maxCols = Math.max(...worksheet.map(row => row.length));
        //tạo index cho cột excel
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const colIndexes = {};
        for (let i = 0; i < maxCols; i++) {
          colIndexes[alphabet[i]] = i;
        }
        // Thêm các cột từ aa - zz
        for (let i = 0; i < maxCols; i++) {
          for (let j = 0; j < maxCols; j++) {
            colIndexes[alphabet[i] + alphabet[j]] = i * 26 + j;
          }
        }
        const colIndexTenNhanVien = colIndexes[req.body.TenNhanVien];
        const colIndexIDViTriCongViec = colIndexes[req.body.IDViTriCongViec];
        const colIndexNgaySinh = colIndexes[req.body.NgaySinh];
        const colIndexGioiTinh = colIndexes[req.body.GioiTinh];
        const colIndexDiaChi = colIndexes[req.body.DiaChi];
        const colIndexSoDienThoai = colIndexes[req.body.SoDienThoai];
        const colIndexTinhTrang = colIndexes[req.body.TinhTrang];
        const colIndexNgayVao = colIndexes[req.body.NgayVao];

        for (let i = 0; i < worksheet.length; i++) {
          if (typeof worksheet[i][colIndexTenNhanVien] !== 'string') {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.TenNhanVien + (i + 1));
          } else if (!Number.isInteger(worksheet[i][colIndexIDViTriCongViec])) {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.IDViTriCongViec + (i + 1));
          } else if (!moment(worksheet[i][colIndexNgaySinh], "YYYY-MM-DD").isValid()) {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.NgaySinh + (i + 1));
          } else if (typeof worksheet[i][colIndexGioiTinh] !== 'string') {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.GioiTinh + (i + 1));
          } else if (typeof worksheet[i][colIndexDiaChi] !== 'string') {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.DiaChi + (i + 1));
          } else if (typeof worksheet[i][colIndexSoDienThoai] !== 'number') {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.SoDienThoai + (i + 1));
          } else if (typeof worksheet[i][colIndexTinhTrang] !== 'string') {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.TinhTrang + (i + 1));
          } else if (!moment(worksheet[i][colIndexNgayVao], "YYYY-MM-DD").isValid()) {
            errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.NgayVao + (i + 1));
          } else {
            try {
              //định dạng lại ngày tháng
              const NgaySinh = moment(worksheet[i][colIndexNgaySinh]).format('YYYY-MM-DD');
              //const NgaySinh = momenttz.tz(new Date((worksheet[i][colIndexNgaySinh] - 25569) * 86400 * 1000), 'Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSSZ');
              const NgayVao = moment(worksheet[i][colIndexNgayVao]).format('YYYY-MM-DD');
              //const NgayVao = momenttz.tz(new Date((worksheet[i][colIndexNgayVao] - 25569) * 86400 * 1000), 'Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSSZ');
              //kiểm tra ký tự đặc biệt trong cột ngày tháng
              if (/[*&^%$#@!()<>\[\]{}| ]/.test(worksheet[i][colIndexNgaySinh]) && !/[/_\-\\]/.test(worksheet[i][colIndexNgaySinh])) {
                errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.NgaySinh + (i + 1));
              } else if (/[*&^%$#@!()<>\[\]{}| ]/.test(worksheet[i][colIndexNgayVao]) && !/[/_\-\\]/.test(worksheet[i][colIndexNgayVao])) {
                errorImport.push('Lỗi tại hàng ' + (i + 1) + "  . Ô Excel: " + req.body.NgayVao + (i + 1));
              } else {
                var data = {
                  TenNhanVien: String(worksheet[i][colIndexTenNhanVien]),
                  IDViTriCongViec: worksheet[i][colIndexIDViTriCongViec],
                  NgaySinh: NgaySinh,
                  GioiTinh: String(worksheet[i][colIndexGioiTinh]),
                  DiaChi: String(worksheet[i][colIndexDiaChi]),
                  SoDienThoai: worksheet[i][colIndexSoDienThoai],
                  TinhTrang: worksheet[i][colIndexTinhTrang],
                  NgayVao: NgayVao
                };
                const result = await sql.insertAccount(data);
                results.push(result);
                if (i == 0) {
                  alertImport = alertImport + (i + 1);
                } else {
                  alertImport = alertImport + `ㅤ` + (i + 1);
                }

              }
            } catch (error) {
              return res.status(500).json({ error: 'Đã xảy ra lỗi khi lưu dữ liệu vào cơ sở dữ liệu' });
            }
          }
        }
        return res.status(200).json({ success: alertImport, errorImport: errorImport });
      } else return res.status(400).json({ success: false, message: "File gửi lên phải là file Excel!" });

    } else {
      res.status(400).json({ success: false, message: "Không phát hiện có file trong quá trình tải lên!" });
    }
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

//chưa xử lý
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


/* Quản lý vai trò */
//tải danh sách vai trò
router.get("/getRole", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "IDVaiTro"//giá trị mặc định cho cột sắp xếp
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
    if (await sql.checkSessionAndRole(ss, 'getRole')) {
      let result = await sql.getRole();
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter((row) => {
          const searchData = req.query.id;
          const searchBy = 'IDVaiTro';
          // Lấy giá trị cột tìm kiếm
          const columnData = row[searchBy];
          const stringColumnData = String(columnData);
          const lowerCaseColumnData = stringColumnData.toLowerCase();
          const lowerCaseSearchData = searchData.toLowerCase();
          return lowerCaseColumnData.includes(lowerCaseSearchData);
        })
        //lấy danh sách quyền ứng với vai trò
        let resultgetPermissionRoleByID = await sql.getListPermissionByIDRole(req.query.id);
        const convertIDPermissionRole = resultgetPermissionRoleByID.map(item => {
          return item.IDQuyen;
        });

        const newFilteredData = {
          ...filteredData[0],
          IDQuyen: convertIDPermissionRole
        };
        res.status(200).json(newFilteredData)
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TenVaiTro'];

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
          if (sortBy === 'TenVaiTro') {
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
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

// thêm vai trò mới
router.post('/insertRole', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertRole')) {
    if (req.body.TenVaiTro !== '' || req.body.IDQuyen.length !== 0) {
      sql.insertRole(data)
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

// tải danh sách quyền
router.get("/getPermission", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'getPermission')) {
      let result = await sql.getPermission();
      res.status(200).json(result);
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

//Cập nhật vai trò
router.put('/updateRole', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateRole')) {
    if (req.body.TenVaiTro !== '' || req.body.IDQuyen.length !== 0) {
      sql.updateRole(data)
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
//Xoá vai trò
router.delete('/deleteRole', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteRole')) {
    if (req.body.IDs) {
      for (const ID of IDs) {
        sql.deleteRole(ID)
          .then(result => {
            if (result.success) {
            }
          })
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



//  Quản lý vị trí công việc
router.get("/getJobPosition", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "IDViTriCongViec"//giá trị mặc định cho cột sắp xếp
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
    if (await sql.checkSessionAndRole(ss, 'getJobPosition')) {
      let result = await sql.getJobPosition();
      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter((row) => {
          const searchData = req.query.id;
          const searchBy = 'IDViTriCongViec';
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
          const vietnameseColumns = ['TenViTriCongViec'];

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
          if (sortBy === 'TenViTriCongViec') {
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
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

//Xoá vị trí công việc
router.delete('/deleteJobPosition', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteJobPosition')) {
    if (req.body.IDs) {
      for (const ID of IDs) {
        sql.deleteJobPosition(ID)
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

// Thêm vị trí công việc mới
router.post('/insertJobPosition', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertJobPosition')) {
    if (req.body.TenViTriCongViec !== '') {
      sql.insertJobPosition(data)
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

//Cập nhật vị trí công việc
router.put('/updateJobPosition', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateJobPosition')) {
    if (req.body.TenViTriCongViec !== '') {
      sql.updateJobPosition(data)
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

module.exports = router;
