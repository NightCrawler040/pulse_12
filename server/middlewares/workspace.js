export const requireWorkspaceAccess = (req, res, next) => {
  const user = req.currentUser;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Admin sees everything, bypass workspace check
  if (user.roleType === 'admin') {
    req.userWorkspaceIds = []; // not really used for admin, they see all
    return next();
  }
  
  // Extract workspaceId from params, body, or query
  const workspaceId = req.params.workspaceId || req.body?.workspaceId || req.query?.workspaceId;
  
  // If a specific workspace is requested, verify the user has access
  if (workspaceId) {
    if (!(user.workspaceIds || []).includes(workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к данному workspace' });
    }
  }

  // Make user's workspaces easily accessible for further filtering in the route
  req.userWorkspaceIds = user.workspaceIds || [];
  next();
};
