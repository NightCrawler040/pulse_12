import express from 'express';
import { getDbData, setDbData, setIo } from '../store.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireWorkspaceAccess } from '../middlewares/workspace.js';
import { getActor } from '../services/authService.js';

const router = express.Router();

router.use(requireAuth);
// router.use(requireWorkspaceAccess('hr_orders')); // We will filter manually

router.get('/', (req, res) => {
  const dbData = getDbData();
  const user = req.currentUser || getActor();
  const userWorkspaces = user?.workspaceIds || [];
  
  if (!dbData.hr_orders) {
    dbData.hr_orders = [];
    setDbData(dbData);
  }

  // Filter orders by user's workspaces
  if (user?.roleType === 'admin') {
    return res.json(dbData.hr_orders);
  }
  
  const filtered = dbData.hr_orders.filter(o => !o.workspaceId || userWorkspaces.includes(o.workspaceId));
  res.json(filtered);
});

router.post('/', (req, res) => {
  const dbData = getDbData();
  const orderData = req.body;
  const newId = `hro-${Date.now()}`;
  
  const newOrder = {
    ...orderData,
    id: newId,
    createdAt: new Date().toISOString()
  };
  
  if (!dbData.hr_orders) dbData.hr_orders = [];
  dbData.hr_orders.unshift(newOrder);
  setDbData(dbData);
  
  const io = setIo();
  if (io) io.emit('data-updated', dbData); // Or targeted broadcast
  
  res.status(201).json(newOrder);
});

router.put('/:id', (req, res) => {
  const dbData = getDbData();
  const index = dbData.hr_orders?.findIndex(o => o.id === req.params.id);
  if (index === -1 || index === undefined) return res.status(404).json({ error: 'Not found' });
  
  // Minimal workspace check
  const order = dbData.hr_orders[index];
  const user = req.currentUser || getActor();
  if (user?.roleType !== 'admin' && order.workspaceId && !user?.workspaceIds?.includes(order.workspaceId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  dbData.hr_orders[index] = { ...order, ...req.body, updatedAt: new Date().toISOString() };
  setDbData(dbData);
  
  const io = setIo();
  if (io) io.emit('data-updated', dbData); // Or targeted
  
  res.json(dbData.hr_orders[index]);
});

router.delete('/:id', (req, res) => {
  const dbData = getDbData();
  const index = dbData.hr_orders?.findIndex(o => o.id === req.params.id);
  if (index === -1 || index === undefined) return res.status(404).json({ error: 'Not found' });
  
  const order = dbData.hr_orders[index];
  const user = req.currentUser || getActor();
  if (user?.roleType !== 'admin' && order.workspaceId && !user?.workspaceIds?.includes(order.workspaceId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  dbData.hr_orders.splice(index, 1);
  setDbData(dbData);
  
  const io = setIo();
  if (io) io.emit('data-updated', dbData);
  
  res.status(204).send();
});

export default router;
