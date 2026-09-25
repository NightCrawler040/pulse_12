const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel/AdminPanel.tsx', 'utf8');

code = code.replace(/const handleOpenEditModal = \(user: User\) => \{([\s\S]*?)setIsModalOpen\(true\);\s*\};/, 
`const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setErrorMessage(null);
    setName(user.name || '');
    setEmail(user.email || '');
    setLoginStr(user.login || (user.email ? user.email.split('@')[0] : '') || '');
    setPasswordStr(user.password || user.pin || '1234');
    setDepartment(user.department || '');
    setRoleTitle(user.role || '');
    setRoleType(user.roleType || 'member');
    setPin('');
    setPasswordStr('');
    setAvatar(user.avatar || '');
    setIsModalOpen(true);
  };`);

code = code.replace(/const handleSaveUser = \(e: React\.FormEvent\) => \{[\s\S]*?setIsModalOpen\(false\);\s*\};/,
`const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const safeEmail = email || '';
    const safeName = name || '';
    const safeLogin = loginStr || '';
    const safeDepartment = department || '';
    const safeRoleTitle = roleTitle || '';
    const safeAvatar = avatar || '';

    const trimmedEmail = safeEmail.trim().toLowerCase();
    const finalLogin = (safeLogin.trim() || trimmedEmail.split('@')[0] || \`user_\${Date.now()}\`).toLowerCase();

    const duplicateUser = users.find(u => {
      if (editingUser && u.id === editingUser.id) return false;
      const uEmail = (u.email || '').trim().toLowerCase();
      const uLogin = (u.login || uEmail.split('@')[0] || '').trim().toLowerCase();
      return (trimmedEmail && uEmail === trimmedEmail) || (finalLogin && uLogin === finalLogin);
    });

    if (duplicateUser) {
      setErrorMessage(\`⚠️ Ошибка: Сотрудник с почтой «\${safeEmail}» или логином «\${safeLogin || finalLogin}» уже существует (\${duplicateUser.name})! Укажите уникальные данные.\`);
      return;
    }
    setErrorMessage(null);

    const typedPass = passwordStr.trim() || pin.trim();

    if (editingUser) {
      const updates: Partial<User> = {
        name: safeName.trim(),
        email: safeEmail.trim(),
        login: finalLogin,
        department: safeDepartment.trim(),
        role: safeRoleTitle.trim(),
        roleType,
        avatar: safeAvatar.trim() || editingUser.avatar
      };
      if (typedPass) {
        updates.password = typedPass;
        updates.pin = typedPass;
      }
      updateUser(editingUser.id, updates);
    } else {
      addUser({
        name: safeName.trim(),
        email: safeEmail.trim() || \`\${safeName.toLowerCase().replace(/\\s+/g, '.')}@corp.lan\`,
        login: finalLogin,
        password: typedPass || '',
        department: safeDepartment.trim(),
        role: safeRoleTitle.trim(),
        roleType,
        pin: typedPass || '',
        avatar: safeAvatar.trim(),
        isActive: true
      });
    }
    setIsModalOpen(false);
  };`);

fs.writeFileSync('src/components/AdminPanel/AdminPanel.tsx', code);
