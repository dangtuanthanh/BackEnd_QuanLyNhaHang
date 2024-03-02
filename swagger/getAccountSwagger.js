/**
 * @swagger
 * /getAccount:
 *   get:
 *     summary: Lấy danh sách tài khoản
 *     description: Lấy danh sách tài khoản từ nguồn dữ liệu
 *     parameters:
 *       - in: header
 *         name: ss
 *         required: true
 *         schema:
 *           type: string
 *         description: Mã phiên đăng nhập
 *     responses:
 *       200:
 *         description: Thành công. Trả về danh sách tài khoản.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Account'
 *       401:
 *         description: Unauthorized. Yêu cầu xác thực không hợp lệ hoặc thiếu phiên đăng nhập.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi. Không thể lấy danh sách tài khoản.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Account:
 *       type: object
 *       properties:
 *         IDNhanVien:
 *           type: integer
 *         TenNhanVien:
 *           type: string
 *         TaiKhoan:
 *           type: string
 *         HinhAnh:
 *           type: string
 *         IDVaiTro:
 *           type: integer
 *         TenVaiTro:
 *           type: string
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         error:
 *           type: string
 */