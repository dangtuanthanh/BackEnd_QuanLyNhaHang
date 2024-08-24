var express = require('express');
const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();
const moment = require('moment');
const multer = require('multer');//upload
const path = require('path');//xử lý đường dẫn 

const sql = require("../handle/handleHoaDon");//load file xử lý
// Middleware kiểm tra và xác thực tên miền truy cập
// const checkDomainAccess = (allowedDomains) => {
//   return (req, res, next) => {
//     const domain = req.headers.origin;
//     if (allowedDomains.includes(domain)) {
//       next();
//     } else {
//       res.status(403).send('Forbidden');
//     }z
//   };
// };
// app.use(checkDomainAccess(['https://your-allowed-domain.com']));

router.use(bodyParser.json());//cho phép xử lý dữ liệu gửi lên dạng json
router.use(bodyParser.urlencoded({ extended: false }));//cho phép xử lý dữ liệu gửi lên dạng application/x-www-form-urlencoded

router.get("/HoaDon", function (req, res, next) {
  res.render("index", { title: "Trang Hoá Đơn" });
});

/*  Quản lý hoá đơn */
// Lấy danh sách hoá đơn
router.get("/getInvoice", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const iddoitac = req.headers.iddoitac;
  if (req.headers.iddoitac) {
    const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
    var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
    var sortBy = "IDHoaDon"//giá trị mặc định cho cột sắp xếp
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
      // if (await sql.checkSessionAndRole(ss, 'getInvoice')) {
      let result = await sql.getInvoice(iddoitac);
      //xử lý định dạng ngày về dd/mm/yyyy
      result = result.map(item => {
        const date = new Date(item.NgayLapHoaDon);

        return {
          ...item,
          NgayLapHoaDon: `${date.getDate() < 10 ? '0' + date.getDate() : date.getDate()}/${date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1}/${date.getFullYear()} ${date.getHours() < 10 ? '0' + date.getHours() : date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}:${date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds()}`
        }
      })
      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter(item => item.IDHoaDon == req.query.id);
        //lấy danh sách chi tiết hoá đơn theo ID
        const resultListInvoiceDetailsByID = await sql.getListInvoiceDetailsByID(iddoitac, req.query.id);
        const newFilteredData = {
          ...filteredData[0],
          DanhSach: resultListInvoiceDetailsByID
        };
        res.status(200).json(newFilteredData)
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TenBan', 'TenNhanVien', 'TenKhachHang'];

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
              } else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
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
        function compareDate(date1, date2) {
          const mDate1 = moment(date1, 'DD/MM/YYYY HH:mm:ss');
          const mDate2 = moment(date2, 'DD/MM/YYYY HH:mm:ss');
          if (mDate1.isBefore(mDate2)) {
            return sortOrder === 'asc' ? -1 : 1;
          }

          if (mDate1.isAfter(mDate2)) {
            return sortOrder === 'asc' ? 1 : -1;
          }
        }
        result.sort((a, b) => {
          if (sortBy === 'TenBan' || sortBy === 'TenNhanVien' || sortBy === 'TenKhachHang') {
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
          }
          else if (sortBy === 'NgayLapHoaDon') {
            return compareDate(a.NgayLapHoaDon, b.NgayLapHoaDon, sortOrder);
          }
          else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
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
        const date = new Date();
        const formattedDate = `${date.getDate() < 10 ? '0' + date.getDate() : date.getDate()
          }/${date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1
          }/${date.getFullYear()}`

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
          DateCurrent: formattedDate,
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

// Thêm hoá đơn
router.post('/insertInvoice', async function (req, res, next) {
  const ss = req.headers.ss;
  const iddoitac = req.headers.iddoitac;
  // if (await sql.checkSessionAndRole(ss, 'insertInvoice')) {
  if (req.body.IDNhanVien && req.body.DanhSach.length > 0 && req.headers.iddoitac) {
    //kiểm tra có ghi chú hay không
    var ghiChu = null;
    if (req.body.GhiChu || req.body.GhiChu !== '') {
      ghiChu = req.body.GhiChu;
    }
    //kiểm tra có IDBan hay không
    var IDBan = null;
    if (req.body.IDBan || req.body.IDBan !== '') {
      IDBan = req.body.IDBan;
    }
    //kiểm tra có Khách Hàng hay không
    var IDKhachHang = null;
    if (req.body.IDKhachHang || req.body.IDKhachHang !== '') {
      IDKhachHang = req.body.IDKhachHang;
    }
    //kiểm tra có tên khu vực hay không
    var TenKhuVuc = null;
    if (req.body.TenKhuVuc || req.body.TenKhuVuc !== '') {
      TenKhuVuc = req.body.TenKhuVuc;
    }
    //kiểm tra có giảm giá hay không
    var GiamGia = null;
    if (req.body.GiamGia || req.body.GiamGia !== '') {
      GiamGia = req.body.GiamGia;
    }
    //kiểm tra có phương thức giảm giá hay không
    var PhuongThucGiamGia = null;
    if (req.body.PhuongThucGiamGia || req.body.PhuongThucGiamGia !== '') {
      PhuongThucGiamGia = req.body.PhuongThucGiamGia;
    }
    //kiểm tra có trạng thái thanh toán hay không
    var TrangThaiThanhToan = false;
    if (req.body.TrangThaiThanhToan) {
      TrangThaiThanhToan = req.body.TrangThaiThanhToan;
    }
    //kiểm tra có phương thức thanh toán hay không
    var ThanhToanChuyenKhoan = null;
    if (req.body.ThanhToanChuyenKhoan === true || req.body.ThanhToanChuyenKhoan === false) {
      ThanhToanChuyenKhoan = req.body.ThanhToanChuyenKhoan;
    }
    var SuDungDiemKhachHang = null;
    if (req.body.SuDungDiemKhachHang === true) {
      SuDungDiemKhachHang = req.body.SuDungDiemKhachHang;
    }
    var DiemKhachHang = null;
    if (req.body.DiemKhachHang) {
      DiemKhachHang = req.body.DiemKhachHang;
    }
    //lấy ngày giờ hôm nay để thêm vào NgayLapHoaDon
    const date = new Date();
    const datetime = date.toISOString();
    var data = {
      IDBan: IDBan,
      IDNhanVien: req.body.IDNhanVien,
      IDKhachHang: IDKhachHang,
      TenKhuVuc: TenKhuVuc,
      NgayLapHoaDon: datetime,
      ghiChu: ghiChu,
      GiamGia: GiamGia,
      PhuongThucGiamGia: PhuongThucGiamGia,
      DanhSach: req.body.DanhSach,
      TrangThaiThanhToan: TrangThaiThanhToan,
      ThanhToanChuyenKhoan: ThanhToanChuyenKhoan,
      SuDungDiemKhachHang: SuDungDiemKhachHang,
      DiemKhachHang: DiemKhachHang
    };

    try {
      const result = await sql.insertInvoice(iddoitac, data)
      res.status(200).json({ result: result, success: true, message: "Thêm Dữ Liệu Thành Công!" });
    }
    catch (error) {
      console.log("error", error);
      res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
    }
  } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác !" });
  // } else {
  //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập !" });
  // }
});
//Cập nhật hoá đơn
router.put('/updateInvoice', async function (req, res, next) {
  const ss = req.headers.ss;
  const iddoitac = req.headers.iddoitac;
  // if (await sql.checkSessionAndRole(ss, 'updateInvoice')) {
  if (req.body.IDHoaDon && req.body.IDNhanVien && req.body.DanhSach.length > 0 && req.headers.iddoitac) {
    //kiểm tra có ghi chú hay không
    var ghiChu = null;
    if (req.body.GhiChu || req.body.GhiChu !== '') {
      ghiChu = req.body.GhiChu;
    }
    //kiểm tra có IDBan hay không
    var IDBan = null;
    if (req.body.IDBan || req.body.IDBan !== '') {
      IDBan = req.body.IDBan;
    }
    //kiểm tra có Khách Hàng hay không
    var IDKhachHang = null;
    if (req.body.IDKhachHang || req.body.IDKhachHang !== '') {
      IDKhachHang = req.body.IDKhachHang;
    }
    //kiểm tra có tên khu vực hay không
    var TenKhuVuc = null;
    if (req.body.TenKhuVuc || req.body.TenKhuVuc !== '') {
      TenKhuVuc = req.body.TenKhuVuc;
    }
    //kiểm tra có giảm giá hay không
    var GiamGia = null;
    if (req.body.GiamGia || req.body.GiamGia !== '') {
      GiamGia = req.body.GiamGia;
    }
    //kiểm tra có phương thức giảm giá hay không
    var PhuongThucGiamGia = null;
    if (req.body.PhuongThucGiamGia || req.body.PhuongThucGiamGia !== '') {
      PhuongThucGiamGia = req.body.PhuongThucGiamGia;
    }
    //kiểm tra có trạng thái thanh toán hay không
    var TrangThaiThanhToan = false;
    if (req.body.TrangThaiThanhToan || req.body.TrangThaiThanhToan !== '') {
      TrangThaiThanhToan = req.body.TrangThaiThanhToan;
    }
    //kiểm tra có phương thức thanh toán hay không
    var ThanhToanChuyenKhoan = null;
    if (req.body.ThanhToanChuyenKhoan === true || req.body.ThanhToanChuyenKhoan === false) {
      ThanhToanChuyenKhoan = req.body.ThanhToanChuyenKhoan;
    }
    var SuDungDiemKhachHang = null;
    if (req.body.SuDungDiemKhachHang === true) {
      SuDungDiemKhachHang = req.body.SuDungDiemKhachHang;
    }
    var DiemKhachHang = null;
    if (req.body.DiemKhachHang) {
      DiemKhachHang = req.body.DiemKhachHang;
    }
    // không cần thiết vì ngày lập ko nên sửa
    // //lấy ngày giờ hôm nay để thêm vào NgayLapHoaDon
    // const date = new Date();
    // const datetime = date.toISOString();
    var data = {
      IDHoaDon: req.body.IDHoaDon,
      IDBan: IDBan,
      IDNhanVien: req.body.IDNhanVien,
      IDKhachHang: IDKhachHang,
      TenKhuVuc: TenKhuVuc,
      TrangThaiThanhToan: TrangThaiThanhToan,
      GhiChu: ghiChu,
      GiamGia: GiamGia,
      PhuongThucGiamGia: PhuongThucGiamGia,
      DanhSach: req.body.DanhSach,
      TrangThaiThanhToan: TrangThaiThanhToan,
      ThanhToanChuyenKhoan: ThanhToanChuyenKhoan,
      SuDungDiemKhachHang: SuDungDiemKhachHang,
      DiemKhachHang: DiemKhachHang
    };


    sql.updateInvoice(iddoitac, data)
      .then(() => {
        res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
      })
      .catch(error => {
        console.log("error", error);
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
      });
  } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác !" });
  // } else {
  //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  // }
});

//Xoá hoá đơn
router.delete('/deleteInvoice', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteInvoice')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      for (const ID of IDs) {
        sql.deleteInvoice(IDDoiTac, ID)
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
//Cập nhật trạng thái bàn ăn
router.put('/updateStatusTable', async function (req, res, next) {
  const ss = req.headers.ss;
  if (await sql.checkSessionAndRole(ss, 'updateInvoice')) {
    if (req.body.IDBan && req.body.TrangThai) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      var data = {
        IDBan: req.body.IDBan,
        TrangThai: req.body.TrangThai
      };
      sql.updateStatusTable(IDDoiTac, data)
        .then(() => {
          res.status(200).json({ success: true, message: "Cập Nhật Dữ Liệu Thành Công!" });
        })
        .catch(error => {
          console.log("error", error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác !" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
router.get("/getPicturePayment", async function (req, res, next) {
  if (req.headers.iddoitac) {
    sql.getPicturePayment(req.headers.iddoitac)
      .then(result => {
        res.status(200).json(result);
      })
      .catch(error => {
        console.log('error', error)
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
      });
  } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác !" });
})
//Cập nhật ảnh qr thanh toán
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'img/AnhThanhToan/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});
const newupload = multer({ storage: storage });
router.put('/updatePicturePayment', newupload.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var HinhAnh = null
  if (await sql.checkSessionAndRole(ss, 'updateSystem')) {
    if (req.file) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      imagePath = req.file.path
      const domain = req.headers.host;
      const newPath = imagePath ? path.relative('img/AnhThanhToan', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
      const imagePathWithDomain = `http://${domain}/AnhThanhToan/${newPath}`;
      // Sử dụng thư viện sharp để thay đổi kích thước ảnh
      const sharp = require('sharp');
      const outputFilePath = path.join('img/AnhThanhToan', 'resized-' + req.file.filename);

      try {
        await sharp(imagePath)
          .resize(540, 540) // Thay đổi kích thước và cắt thành hình vuông
          .toFile(outputFilePath);

        HinhAnh = `http://${domain}/AnhThanhToan/${path.relative('img/AnhThanhToan', outputFilePath)}`;

        //HinhAnh = imagePathWithDomain

        sql.updatePicturePayment(IDDoiTac, HinhAnh)
          .then(() => {
            res.status(200).json({ success: true, message: "Cập Nhật Dữ Liệu Thành Công!" });
          })
          .catch(error => {
            console.log("error", error);
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      } catch (error) {
        console.log("error", error);
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý ảnh', error: error });
      }
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác !" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật phần trăm điểm khách hàng
router.put('/updatePerPointCustomert', async function (req, res, next) {
  const ss = req.headers.ss;
  if (await sql.checkSessionAndRole(ss, 'updateSystem')) {
    if (req.body.TiLe) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      sql.updatePerPointCustomert(IDDoiTac, req.body.TiLe)
        .then(() => {
          res.status(200).json({ success: true, message: "Cập Nhật Dữ Liệu Thành Công!" });
        })
        .catch(error => {
          console.log("error", error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác !" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
router.get("/getPerPointCustomert", async function (req, res, next) {
  const ss = req.headers.ss;
  if (await sql.checkSessionAndRole(ss, 'updateSystem')) {
    const IDDoiTac = await sql.getIDDoiTac(ss)
    sql.getPerPointCustomert(IDDoiTac)
      .then(result => {
        res.status(200).json(result);
      })
      .catch(error => {
        console.log('error', error)
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
      });
  }
  else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
})
const uploadLogo = multer({ storage: storage });
router.put('/updateLogo', uploadLogo.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var HinhAnh = null
  if (await sql.checkSessionAndRole(ss, 'updateSystem')) {
    if (req.file) {
      const IDDoiTac = await sql.getIDDoiTac(ss)
      imagePath = req.file.path
      const domain = req.headers.host;
      // Sử dụng thư viện sharp để thay đổi kích thước ảnh
      const sharp = require('sharp');
      const outputFilePath = path.join('img/Logo', 'resized-' + req.file.filename);

      try {
        await sharp(imagePath)
          .resize(150, 76) // Thay đổi kích thước và cắt thành hình vuông
          .toFile(outputFilePath);

        HinhAnh = `http://${domain}/Logo/${path.relative('img/Logo', outputFilePath)}`;

        //HinhAnh = imagePathWithDomain

        sql.updateLogo(IDDoiTac, HinhAnh)
          .then(() => {
            res.status(200).json({ success: true, message: "Cập Nhật Dữ Liệu Thành Công!" });
          })
          .catch(error => {
            console.log("error", error);
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      } catch (error) {
        console.log("error", error);
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý ảnh', error: error });
      }
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác !" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});


// router.get("/checkStatusTable", async function (req, res, next) {
//   sql.getPerPointCustomert()
//     .then(result => {
//       res.status(200).json(result);
//     })
//     .catch(error => {
//       console.log('error', error)
//       res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
//     });
// })
module.exports = router;