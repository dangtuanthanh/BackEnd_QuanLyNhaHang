var express = require('express');
const cors = require('cors');//lỗi CORS
const bodyParser = require('body-parser');//phương thức POST
var router = express.Router();
const sql = require("../dboperation");//load file dboperation
const multer = require('multer');//upload
const upload = multer({ dest: 'uploads/' });//upload
const xlsx = require('node-xlsx');
const moment = require('moment');
const momenttz = require('moment-timezone');

router.use(cors());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.get("/", function (req, res, next) {
  res.render("index", { title: "VRes" });
});

//tải dữ liệu tài khoản
router.get("/getAccount", async function (req, res, next) {
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  const itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getAccount')) {
      const result = await sql.getAccount();

      const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
      res.status(200).json({
        currentPage,//trang hiện tại
        itemsPerPage,//số hàng trên trang
        totalItems: result.length,//tổng số dữ liệu
        totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
        data,//dữ liệu trên trang hiện tại
      });
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});



//thêm dữ liệu tài khoản
router.post('/insertAccount', function (req, res, next) {
  try {
    const ss = req.headers.ss;
    const data = req.body;
    sql.insertAccount(data, ss)
      .then((result) => {
        res.status(200).json(result);
      })
  } catch (error) {
    console.log("Lỗi không thêm được dữ liệu: " + error);
    let errorMessage = "Có lỗi xảy ra khi thêm dữ liệu.";
    if (error.message) {
      errorMessage = error.message;
    }
    res.status(500).json({ message: 'Lỗi không thêm được dữ liệu', errorMessage });
  }
});

//lấy dữ liệu của 1 tài khoản
router.get('/getAccountById/:ID', function (req, res, next) {
  const ss = req.headers.ss;
  const ID = req.params.ID;
  sql.getAccountById(ID, ss).then((result) => {
    res.status(200).json(result);
  }).catch((error) => {
    console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
    res.status(500).json({ message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  });
});



//Cập nhật tài khoản
router.put('/updateAccount/:ID', function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  const ID = req.params.ID;
  sql.updateAccount(ID, data, ss).then((result) => {
    res.status(200).json(result);
  })
    .catch((error) => {
      console.log("Lỗi khi cập nhật tài khoản: " + error);
      res.status(500).json({ message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
    });
});


//Xoá tài khoản
let deletedData = [];
router.delete('/deleteAccount', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;

  try {
    for (const ID of IDs) {
      const result = await sql.deleteAccount(ID, ss);
      if (result.success) {
        deletedData.push(ID);
      } else {
        return res.status(500).json({ success: false, message: result.message });
      }
    }

    res.status(200).json({ success: true, deletedData, message: "Xoá Dữ Liệu Thành Công!" });
  } catch (error) {
    console.log("Lỗi khi xoá dữ liệu tài khoản: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

// Hàm khôi phục hành động xoá
router.post('/undoDelete', function (req, res, next) {
  const ss = req.headers.ss;
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
    if(result.success){
      res.status(200).json(
        result.message
      );
    }else{
      res.status(401).json(
        result.message
      );
    }
  } catch (error) {
  console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
  res.status(500).json({  message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
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
const path = require('path');
const { log } = require('console');
const { setSeconds } = require('date-fns/fp');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});
const newupload = multer({ storage: storage });

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
