const router = require('express').Router();
const controller = require('../controllers/harvestController');
const { protect, optionalAuth, authorize, approvedFarmer } = require('../middleware/auth');

router.get('/', optionalAuth, controller.listUpcoming);
router.get('/mine', protect, authorize('farmer'), controller.listMine);
router.post('/', protect, approvedFarmer, controller.createHarvest);
router.put('/:id', protect, approvedFarmer, controller.updateHarvest);
router.patch('/:id/status', protect, approvedFarmer, controller.updateStatus);
router.post('/:id/subscribe', protect, authorize('customer'), controller.subscribe);
router.delete('/:id/subscribe', protect, authorize('customer'), controller.unsubscribe);

module.exports = router;
