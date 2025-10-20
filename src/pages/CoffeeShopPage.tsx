import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';

type UserCategory = '利用者' | '職員' | '来客';

type User = {
  id: number;
  name: string;
  reading: string;
  type: Exclude<UserCategory, '来客'>;
};

type Visitor = {
  id: string;
  name: string;
  type: '来客';
};

type SelectedUser = User | Visitor | null;

type Product = {
  id: string;
  name: string;
  price: number;
  customizable: boolean;
};

type OrderStatus = '受付済' | '提供済' | 'キャンセル';

type Order = {
  id: number;
  userId: string;
  userName: string;
  type: UserCategory;
  details: string;
  status: OrderStatus;
  barista: string;
  price: number;
  timestamp: string;
};

const USERS: readonly User[] = [
  { id: 1, name: '山田 太郎', reading: 'やまだたろう', type: '利用者' },
  { id: 2, name: '高橋 三郎', reading: 'たかはしさぶろう', type: '利用者' },
  { id: 3, name: '中村 愛子', reading: 'なかむらあいこ', type: '利用者' },
  { id: 4, name: '伊藤 直樹', reading: 'いとうなおき', type: '利用者' },
  { id: 5, name: '佐藤 花子', reading: 'さとうはなこ', type: '職員' },
  { id: 6, name: '鈴木 次郎', reading: 'すずきじろう', type: '職員' },
  { id: 7, name: '田中 恵美', reading: 'たなかえみ', type: '職員' },
] as const;

const PRODUCTS: readonly Product[] = [
  { id: 'p1', name: 'コーヒー', price: 50, customizable: true },
  { id: 'p2', name: '紅茶', price: 50, customizable: true },
  { id: 'p3', name: 'レモンティー', price: 50, customizable: false },
  { id: 'p4', name: 'ココア', price: 50, customizable: false },
] as const;

const STORAGE_KEY = 'barista_orders';

const CoffeeShopPage: React.FC = () => {
  const [baristaName, setBaristaName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<UserCategory>('利用者');
  const [selectedUser, setSelectedUser] = useState<SelectedUser>(null);
  const [visitorName, setVisitorName] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [options, setOptions] = useState<{ sugar: boolean; milk: boolean }>({ sugar: false, milk: false });
  const [orders, setOrders] = useState<Order[]>([]);
  const [notification, setNotification] = useState<string>('');
  const [notificationSeverity, setNotificationSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [newlyAddedOrderId, setNewlyAddedOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const savedOrders = window.localStorage.getItem(STORAGE_KEY);
      if (savedOrders) {
        const parsed: Order[] = JSON.parse(savedOrders);
        setOrders(parsed);
      }
    } catch (error) {
      console.error('Failed to load orders from localStorage', error);
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (error) {
      console.error('Failed to save orders to localStorage', error);
    }
  }, [orders]);

  const today = useMemo(() => new Date(), []);
  const isWednesday = today.getDay() === 3;

  const orderedUserIds = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ids = new Set<string>();

    orders.forEach((order) => {
      const orderDate = new Date(order.timestamp);
      if (orderDate >= todayStart && order.status !== 'キャンセル') {
        ids.add(order.type === '来客' ? `guest:${order.userName}` : order.userId);
      }
    });

    return ids;
  }, [orders]);

  const filteredUsers = useMemo(() => {
    if (activeCategory === '来客') {
      return [] as User[];
    }
    return USERS.filter(
      (user) =>
        user.type === activeCategory &&
        (user.name.includes(searchTerm) || user.reading.includes(searchTerm)),
    ).sort((a, b) => a.reading.localeCompare(b.reading, 'ja'));
  }, [activeCategory, searchTerm]);

  const waitingQueue = useMemo(() => orders.filter((order) => order.status === '受付済'), [orders]);

  const dailyTotal = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return orders
      .filter((order) => new Date(order.timestamp) >= todayStart)
      .reduce((total, order) => total + order.price, 0);
  }, [orders]);

  const monthlyTotal = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return orders
      .filter((order) => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= startOfMonth && orderDate <= endOfMonth;
      })
      .reduce((total, order) => total + order.price, 0);
  }, [orders]);

  const showNotification = (message: string, severity: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setNotification(message);
    setNotificationSeverity(severity);
    setNotificationOpen(true);
  };

  const handleNotificationClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setNotificationOpen(false);
  };

  const resetOrderFlow = (options?: { preserveVisitorName?: boolean }) => {
    setSearchTerm('');
    setSelectedUser(null);
    setSelectedProduct(null);
    setOptions({ sugar: false, milk: false });
    if (!options?.preserveVisitorName) {
      setVisitorName('');
    }
  };

  const handleCategoryChange = (_event: React.MouseEvent<HTMLElement>, newCategory: UserCategory | null) => {
    if (!newCategory) {
      return;
    }
    const trimmedVisitor = visitorName.trim();
    const preserveVisitorName = newCategory === '来客';
    setActiveCategory(newCategory);
    resetOrderFlow({ preserveVisitorName });
    if (preserveVisitorName) {
      setVisitorName(trimmedVisitor);
      setSelectedUser(trimmedVisitor ? { id: 'visitor_input', name: trimmedVisitor, type: '来客' } : null);
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSelectedProduct(null);
    setOptions({ sugar: false, milk: false });
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    if (!product.customizable) {
      setOptions({ sugar: false, milk: false });
    }
  };

  const handleConfirmOrder = () => {
    if (baristaName.trim() === '') {
      showNotification('担当バリスタ名を入力してください。', 'warning');
      return;
    }
    if (!selectedUser || !selectedProduct) {
      return;
    }

    let userForOrder: SelectedUser = selectedUser;
    if (activeCategory === '来客') {
      const trimmedName = visitorName.trim();
      if (!trimmedName) {
        showNotification('来客のお名前を入力してください。', 'warning');
        return;
      }
      userForOrder = { id: `visitor_${Date.now()}`, name: trimmedName, type: '来客' };
    }

    if (!userForOrder) {
      return;
    }

    const optionLabels: string[] = [];
    if (selectedProduct.customizable) {
      if (options.sugar) {
        optionLabels.push('砂糖あり');
      }
      if (options.milk) {
        optionLabels.push('ミルクあり');
      }
    }

    const optionText = optionLabels.length > 0 ? ` (${optionLabels.join(', ')})` : '';
    const details = `${selectedProduct.name}${optionText}`;

    const newOrder: Order = {
      id: Date.now(),
      userId: userForOrder.type === '来客' ? userForOrder.id : String(userForOrder.id),
      userName: userForOrder.name,
      type: userForOrder.type,
      details,
      status: '受付済',
      barista: baristaName.trim(),
      price: selectedProduct.price,
      timestamp: new Date().toISOString(),
    };

    setOrders((prev) => [...prev, newOrder]);
    setNewlyAddedOrderId(newOrder.id);
    showNotification(`${userForOrder.name} 様の注文を受け付けました。`, 'success');
    resetOrderFlow();
  };

  useEffect(() => {
    if (!newlyAddedOrderId) {
      return;
    }
    const timer = window.setTimeout(() => setNewlyAddedOrderId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [newlyAddedOrderId]);

  const handleServe = (orderId: number) => {
    setOrders((prev) => {
      const servedOrder = prev.find((order) => order.id === orderId);
      const next: Order[] = prev.map((order) =>
        order.id === orderId ? { ...order, status: '提供済' as OrderStatus } : order
      );
      if (servedOrder) {
        showNotification(`${servedOrder.userName} 様の注文を提供済に更新しました。`, 'success');
      }
      return next;
    });
  };

  const handleVisitorInputChange = (value: string) => {
    setVisitorName(value);
    if (activeCategory === '来客') {
      const trimmed = value.trim();
      setSelectedUser(trimmed ? { id: 'visitor_input', name: trimmed, type: '来客' } : null);
    }
  };

  const visitorDisplayName =
    activeCategory === '来客'
      ? visitorName || (selectedUser?.type === '来客' ? selectedUser.name : '')
      : selectedUser?.name ?? '';

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        py: { xs: 2, md: 3 },
      }}
    >
      <Container
        maxWidth="xl"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
        >
          <Box>
            <Typography variant="h4" component="h1" fontWeight={700} color="warning.dark">
              いそかつバリスタボード
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip color="warning" variant="outlined" label={`本日売上: ${dailyTotal.toLocaleString()}円`} />
              <Chip color="success" variant="outlined" label={`今月売上: ${monthlyTotal.toLocaleString()}円`} />
            </Stack>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              id="baristaName"
              label="担当バリスタ"
              value={baristaName}
              onChange={(event) => setBaristaName(event.target.value)}
              placeholder="名前を入力"
              size="small"
              sx={{ width: { xs: '100%', md: 240 } }}
            />
            <Button variant="outlined" color="warning" href="/coffee-shop/summary">
              集計ページへ
            </Button>
          </Stack>
        </Stack>

        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <Stack
            direction="row"
            spacing={3}
            sx={{ height: '100%', overflowX: 'auto', pr: 1, pb: 1 }}
          >
            <Box sx={{ flex: '0 0 320px', display: 'flex', minHeight: 0 }}>
              <Card elevation={3} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Typography variant="h6" fontWeight={700} color="warning.dark" gutterBottom>
                    ① 注文者を選択
                  </Typography>
                  <TextField
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="名前・よみがなで検索"
                    fullWidth
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <ToggleButtonGroup
                    value={activeCategory}
                    exclusive
                    onChange={handleCategoryChange}
                    fullWidth
                    sx={{ mt: 2 }}
                  >
                    {(['利用者', '職員', '来客'] as const).map((category) => (
                      <ToggleButton key={category} value={category} sx={{ fontWeight: 600 }}>
                        {category}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
                    <Stack spacing={1.5}>
                      {activeCategory === '来客' ? (
                        <TextField
                          value={visitorName}
                          onChange={(event) => handleVisitorInputChange(event.target.value)}
                          placeholder="来客のお名前を入力"
                          fullWidth
                          size="small"
                        />
                      ) : (
                        filteredUsers.map((user) => {
                          const hasOrdered = orderedUserIds.has(String(user.id));
                          const isSelected = selectedUser?.id === user.id;
                          return (
                            <Button
                              key={user.id}
                              variant={isSelected ? 'contained' : 'outlined'}
                              color={isSelected ? 'warning' : 'inherit'}
                              fullWidth
                              onClick={() => handleSelectUser(user)}
                              disabled={hasOrdered}
                              sx={{
                                justifyContent: 'space-between',
                                borderColor: isSelected ? 'warning.main' : undefined,
                                opacity: hasOrdered ? 0.6 : 1,
                              }}
                            >
                              <Typography variant="body1" fontWeight={600}>
                                {user.name}
                              </Typography>
                              {hasOrdered && <Chip label="注文済" size="small" color="success" />}
                            </Button>
                          );
                        })
                      )}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: '0 0 360px', display: 'flex', minHeight: 0 }}>
              <Card
                elevation={3}
                sx={{
                  flex: 1,
                  opacity: selectedUser ? 1 : 0.6,
                  pointerEvents: selectedUser ? 'auto' : 'none',
                  transition: 'opacity 0.3s ease',
                }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Typography variant="h6" fontWeight={700} color="warning.dark">
                    ② 商品をタップ
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {selectedUser ? (
                      <>
                        <Box component="span" fontWeight={700} color="text.primary">
                          {visitorDisplayName}
                        </Box>
                        {' '}
                        様の注文
                      </>
                    ) : (
                      '注文者を選択してください。'
                    )}
                  </Typography>

                  <Box sx={{ flexGrow: 1, mt: 3 }}>
                    {selectedProduct && selectedProduct.customizable ? (
                      <Stack spacing={3} sx={{ height: '100%' }}>
                        <Typography variant="h6" align="center" color="warning.main">
                          {selectedProduct.name} のオプション
                        </Typography>
                        <Stack direction="row" spacing={2}>
                          <Box sx={{ flex: 1 }}>
                            <Button
                              fullWidth
                              variant={options.sugar ? 'contained' : 'outlined'}
                              color="warning"
                              onClick={() => setOptions((prev) => ({ ...prev, sugar: !prev.sugar }))}
                              sx={{ py: 2 }}
                            >
                              砂糖
                            </Button>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Button
                              fullWidth
                              variant={options.milk ? 'contained' : 'outlined'}
                              color="warning"
                              onClick={() => setOptions((prev) => ({ ...prev, milk: !prev.milk }))}
                              sx={{ py: 2 }}
                            >
                              ミルク
                            </Button>
                          </Box>
                        </Stack>
                        <Button variant="outlined" onClick={() => setSelectedProduct(null)} sx={{ mt: 'auto' }}>
                          商品を選び直す
                        </Button>
                      </Stack>
                    ) : (
                      <Stack spacing={2}>
                        {PRODUCTS.map((product) => {
                          const isCocoa = product.name === 'ココア';
                          const isSelected = selectedProduct?.id === product.id;
                          if (isCocoa && !isWednesday) {
                            return (
                              <Paper
                                key={product.id}
                                variant="outlined"
                                sx={{
                                  py: 5,
                                  textAlign: 'center',
                                  color: 'text.disabled',
                                  bgcolor: 'action.hover',
                                }}
                              >
                                <Typography variant="h6">{product.name}</Typography>
                                <Typography variant="caption">水曜日のみ</Typography>
                              </Paper>
                            );
                          }
                          return (
                            <Button
                              key={product.id}
                              fullWidth
                              variant={isSelected ? 'contained' : 'outlined'}
                              color="warning"
                              onClick={() => handleSelectProduct(product)}
                              sx={{ py: 3, fontSize: '1.25rem', fontWeight: 700 }}
                            >
                              {product.name}
                            </Button>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>

                  <Divider sx={{ my: 2 }} />
                  <Button
                    variant="contained"
                    color="warning"
                    size="large"
                    onClick={handleConfirmOrder}
                    disabled={!selectedProduct || (activeCategory === '来客' && visitorName.trim() === '')}
                  >
                    注文を確定する
                  </Button>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: '0 0 360px', display: 'flex', minHeight: 0 }}>
              <Card elevation={3} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Typography variant="h6" fontWeight={700} color="warning.dark">
                    ③ 注文キュー ({waitingQueue.length}件)
                  </Typography>
                  <Box sx={{ flexGrow: 1, mt: 2, overflowY: 'auto', pr: 1 }}>
                    <Stack spacing={2}>
                      {waitingQueue.map((order) => {
                        const highlighted = order.id === newlyAddedOrderId;
                        return (
                          <Paper
                            key={order.id}
                            variant="outlined"
                            sx={{
                              p: 2.5,
                              borderLeft: highlighted ? 6 : 2,
                              borderColor: highlighted ? 'warning.main' : 'divider',
                              boxShadow: highlighted ? 6 : 1,
                              transition: 'all 0.3s ease',
                            }}
                          >
                            <Stack spacing={1.25}>
                              <Typography variant="h6" color="warning.dark" fontWeight={700}>
                                {order.details}
                              </Typography>
                              <Typography variant="body1" color="text.primary">
                                {order.userName} 様
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                担当: {order.barista}
                              </Typography>
                              <Button
                                variant="contained"
                                color="success"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => handleServe(order.id)}
                              >
                                提供済
                              </Button>
                            </Stack>
                          </Paper>
                        );
                      })}
                      {waitingQueue.length === 0 && (
                        <Paper variant="outlined" sx={{ py: 6, textAlign: 'center' }}>
                          <Typography color="text.secondary">提供待ちの注文はありません。</Typography>
                        </Paper>
                      )}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </Box>
      </Container>

      <Snackbar
        open={notificationOpen}
        autoHideDuration={3000}
        onClose={handleNotificationClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={notificationSeverity} onClose={handleNotificationClose} sx={{ width: '100%' }}>
          {notification}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CoffeeShopPage;
