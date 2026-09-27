const router = require('express').Router();
const controller = require('../controllers/productController');
const { protect, authorize, approvedFarmer } = require('../middleware/auth');

router.get('/', controller.listProducts);
router.get('/mine', protect, authorize('farmer'), controller.myProducts);
router.get('/admin/all', protect, authorize('admin'), controller.adminListProducts);
router.post('/weekly-template/apply', protect, approvedFarmer, controller.applyWeeklyTemplate);
router.patch('/bulk', protect, approvedFarmer, controller.bulkUpdate);
router.get('/:id', controller.getProduct);
router.post('/', protect, approvedFarmer, controller.createProduct);
router.put('/:id', protect, approvedFarmer, controller.updateProduct);
router.patch('/:id/status', protect, approvedFarmer, controller.setProductStatus);
router.post('/:id/weekly-template/apply', protect, approvedFarmer, controller.applyProductTemplate);
router.delete('/:id', protect, authorize('farmer', 'admin'), controller.deleteProduct);

module.exports = router;
