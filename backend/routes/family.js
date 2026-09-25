const router = require('express').Router();
const controller = require('../controllers/familyController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('customer'));
router.get('/', controller.getFamily);
router.get('/favorites', controller.familyFavorites);
router.post('/invite', controller.invite);
router.post('/invites/:from/accept', controller.accept);
router.post('/invites/:from/decline', controller.decline);
router.post('/leave', controller.leave);
router.delete('/members/:id', controller.removeMember);

module.exports = router;
