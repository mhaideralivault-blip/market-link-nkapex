const router = require('express').Router();
const controller = require('../controllers/orderController');
const { protect, authorize, approvedFarmer } = require('../middleware/auth');

router.use(protect);
router.get('/', controller.listOrders);
router.post('/', authorize('customer'), controller.placeOrder);
router.post('/verify-pickup', approvedFarmer, controller.verifyPickup);
router.get('/:id', controller.getOrder);
router.get('/:id/reorder', authorize('customer'), controller.reorder);
router.put('/:id', authorize('customer'), controller.modifyOrder);
router.post('/:id/cancel', authorize('customer'), controller.cancelOrder);
router.patch('/:id/status', approvedFarmer, controller.updateStatus);

module.exports = router;
