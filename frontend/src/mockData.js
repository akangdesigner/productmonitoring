export const MOCK_PRODUCTS = [
  { id: 1, name: 'SK-II 神仙水 230ml',   brand: 'SK-II',              category: 'skincare', emoji: '✨', watsons:{ price:3960, prevPrice:3960, gift:null },        cosmed:{ price:3960, prevPrice:3960, gift:'贈 7ml 體驗版' }, poya:{ price:3480, prevPrice:3960, gift:null } },
  { id: 2, name: '蘭蔻 小黑瓶精華 50ml', brand: 'Lancôme',            category: 'skincare', emoji: '🖤', watsons:{ price:3200, prevPrice:3200, gift:'贈眼霜 5ml' }, cosmed:{ price:3200, prevPrice:3600, gift:null },             poya:{ price:2980, prevPrice:3200, gift:null } },
  { id: 3, name: 'YSL 奢華唇膏 #1966',   brand: 'Yves Saint Laurent', category: 'makeup',   emoji: '💄', watsons:{ price:1350, prevPrice:1350, gift:null },        cosmed:{ price:1350, prevPrice:1500, gift:'贈化妝包' },       poya:{ price:1280, prevPrice:1350, gift:null } },
  { id: 4, name: 'MAC 子彈唇膏 Ruby Woo', brand: 'M·A·C',             category: 'makeup',   emoji: '💋', watsons:{ price:880,  prevPrice:980,  gift:null },        cosmed:{ price:900,  prevPrice:900,  gift:null },             poya:{ price:860,  prevPrice:900,  gift:null } },
  { id: 5, name: '雪花秀 時花秀顏霜 60ml',brand: 'Sulwhasoo',          category: 'skincare', emoji: '🌸', watsons:{ price:5800, prevPrice:5800, gift:'贈潤顏霜 5ml'},cosmed:{ price:5600, prevPrice:5800, gift:null },             poya:{ price:5500, prevPrice:5800, gift:null } },
];

export const MOCK_ALERTS = [
  { id:1, type:'price_drop', title:'SK-II 神仙水 寶雅 降價 12%',   platform:'poya',    old_value:'3960', new_value:'3480', created_at:new Date().toISOString(),              is_read:0 },
  { id:2, type:'price_drop', title:'蘭蔻小黑瓶 康是美降價 11%',    platform:'cosmed',  old_value:'3600', new_value:'3200', created_at:new Date(Date.now()-3600000).toISOString(), is_read:0 },
  { id:3, type:'gift_added', title:'蘭蔻小黑瓶 屈臣氏新增贈品',    platform:'watsons', old_value:'',     new_value:'贈眼霜 5ml', created_at:new Date(Date.now()-7200000).toISOString(), is_read:0 },
  { id:4, type:'price_drop', title:'MAC Ruby Woo 屈臣氏降價 10%', platform:'watsons', old_value:'980',  new_value:'880',  created_at:new Date(Date.now()-86400000).toISOString(), is_read:1 },
  { id:5, type:'gift_added', title:'YSL #1966 康是美新增贈品',     platform:'cosmed',  old_value:'',     new_value:'贈化妝包', created_at:new Date(Date.now()-86400000).toISOString(), is_read:1 },
];

export const MOCK_TREND = [
  { watsons:[3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960], cosmed:[3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960,3960], poya:[3960,3960,3960,3960,3960,3960,3800,3800,3800,3800,3800,3800,3800,3800,3800,3800,3800,3800,3800,3800,3800,3800,3800,3600,3600,3600,3600,3600,3480,3480] },
  { watsons:[3600,3600,3600,3600,3600,3600,3600,3600,3400,3400,3400,3400,3400,3400,3400,3400,3400,3400,3200,3200,3200,3200,3200,3200,3200,3200,3200,3200,3200,3200], cosmed:[3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3600,3200,3200], poya:[3200,3200,3200,3200,3200,3200,3200,3200,3200,3200,3200,3200,3200,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,2980,2980,2980] },
  { watsons:[1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350], cosmed:[1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1500,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350], poya:[1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1350,1280,1280] },
  { watsons:[980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,980,880,880], cosmed:[900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900], poya:[900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,900,860,860,860,860,860,860,860,860] },
];
