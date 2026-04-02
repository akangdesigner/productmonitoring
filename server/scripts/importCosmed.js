const { getDB } = require('../db/index.js');
const { v4: uuidv4 } = require('uuid');
const db = getDB();

// ── 康是美爬取資料 ──
const cosmedData = [
  {"name":"3CE水霧唇露 DOUBLE WIND煙燻莓果","price":425,"origPrice":500},
  {"name":"3CE光澤蜜漾唇膏 4 丁香色 LILAC GLAZE","price":493,"origPrice":580},
  {"name":"3CE輕絨擁吻 絨霧唇膏 10DREAMY 乾燥玫瑰","price":519,"origPrice":610},
  {"name":"3CE水霧唇露 LAYDOWN烏龍奶茶","price":425,"origPrice":500},
  {"name":"3CE水霧唇露 SEPIA焦糖紅栗","price":425,"origPrice":500},
  {"name":"3CE光澤蜜漾唇膏 3 沁心白桃 SOFTEST","price":493,"origPrice":580},
  {"name":"3CE光澤蜜漾唇膏 7 酒心蜜桃 NECTAR","price":493,"origPrice":580},
  {"name":"3CE粉漾柔光潤唇膏 33 新沙 橘子汽水 COOL","price":493,"origPrice":580},
  {"name":"3CE 水滴晶亮唇釉 甜芭樂 NEAT","price":425,"origPrice":500},
  {"name":"3CE極致絲絨柔霧唇釉 01 紅梨色 SPEAK UP","price":425,"origPrice":500},
  {"name":"3CE極致絲絨柔霧唇釉 21 炙鐵棕 HEATED","price":425,"origPrice":500},
  {"name":"3CE極致絲絨柔霧唇釉 02 磚紅色 TAUPE","price":425,"origPrice":500},
  {"name":"3CE光澤蜜漾唇膏 1 月光石 OPAL SHOWER","price":493,"origPrice":580},
  {"name":"3CE水霧唇露 DEAR MARCH三月蜜桃","price":425,"origPrice":500},
  {"name":"3CE輕絨擁吻 絨霧唇膏 09TAUPE BEIGE 皮革暖棕","price":519,"origPrice":610},
  {"name":"3CE粉漾柔光潤唇膏 38 弘大 熱摩卡 SALTY","price":493,"origPrice":580},
  {"name":"3CE光澤蜜漾唇膏 5 流光水晶 RAIN OR SHINE","price":493,"origPrice":580},
  {"name":"3CE輕絨擁吻 絨霧唇膏 02PURE BLENDING 裸霧柔粉","price":519,"origPrice":610},
  {"name":"3CE光澤蜜漾唇膏 2 半日茶 MILKY SHADOW","price":493,"origPrice":580},
  {"name":"3CE輕絨擁吻 絨霧唇膏 03YOUR SIDE 心動桃粉","price":519,"origPrice":610},
  {"name":"3CE輕絨擁吻 絨霧唇膏 04TEXT ME 微醺酒紅","price":519,"origPrice":610},
  {"name":"3CE 水滴晶亮唇釉 冷木桃 ESSENTIAL","price":425,"origPrice":500},
  {"name":"3CE輕絨擁吻 絨霧唇膏 07KNIT 編織晨曦","price":519,"origPrice":610},
  {"name":"3CE輕絨擁吻 絨霧唇膏 06BUDDY 炙熱暖橘","price":519,"origPrice":610},
  {"name":"3CE水霧唇露 NIGHT TALK玫瑰茶語","price":425,"origPrice":500},
  {"name":"3CE極致絲絨柔霧唇釉 20 紅桃Q","price":425,"origPrice":500},
  {"name":"3CE輕絨擁吻 絨霧唇膏 01OAT 原色約定","price":519,"origPrice":610},
  {"name":"3CE輕絨擁吻 絨霧唇膏 05COZY WHISPER 慵懶薔薇","price":519,"origPrice":610},
  {"name":"3CE極致絲絨柔霧唇釉 25 純色裸 SELF MADE","price":425,"origPrice":500},
  {"name":"3CE極致絲絨柔霧唇釉 10 木質玫瑰 CASHMERE NUDE","price":425,"origPrice":500},
  {"name":"3CE粉漾柔光潤唇膏 34 梨泰院 醉薔薇 ROSE","price":493,"origPrice":580},
  {"name":"3CE水霧唇露 BAKE BEIGE奶茶色","price":425,"origPrice":500},
  {"name":"3CE極致絲絨柔霧唇釉 23 高調紅","price":425,"origPrice":500},
  {"name":"3CE光澤蜜漾唇膏 6 梅子果醬 COLDEST","price":493,"origPrice":580},
  {"name":"3CE粉漾柔光潤唇膏 31 漢南 薰衣草之夢 LAVENDER","price":493,"origPrice":580},
  {"name":"3CE極致絲絨柔霧唇釉 03 豆沙紅","price":425,"origPrice":500},
  {"name":"3CE水霧唇露 CHASING ROSE白桃玫瑰","price":425,"origPrice":500},
  {"name":"3CE粉漾柔光潤唇膏 30 梨花大 肉桂卡布 MELTING","price":493,"origPrice":580},
  {"name":"3CE粉漾柔光潤唇膏 32 聖水 秋之蜜柚 PEACHY","price":493,"origPrice":580},
  {"name":"3CE 水滴晶亮唇釉 草莓熊 VERY SURE","price":425,"origPrice":500},
  {"name":"3CE粉漾柔光潤唇膏 36 江南 莓果葡萄 DOUBLE","price":493,"origPrice":580},
  {"name":"3CE 水滴晶亮唇釉 紅茶露 WEEKEND","price":425,"origPrice":500},
  {"name":"3CE粉漾柔光潤唇膏 35 明洞 櫻花果凍 PINK","price":493,"origPrice":580},
  {"name":"3CE粉漾柔光潤唇膏 37 狎鷗亭 冰糖葫蘆 RASPERRY","price":493,"origPrice":580},
  {"name":"3CE水霧唇露 PINK GUAVA紅心芭樂","price":425,"origPrice":500},
  {"name":"3CE水霧唇露 EARLY HOUR煙粉玫瑰","price":425,"origPrice":500},
  {"name":"3CE水霧唇露 CASUAL AFFAIR玫瑰豆沙","price":425,"origPrice":500},
  {"name":"heme 透潤水光唇膏 - 03 Glaze Mocha 2g","price":299,"origPrice":360},
  {"name":"heme 透潤水光唇膏 - 02 Crystal Berry 2g","price":299,"origPrice":360},
  {"name":"heme 透潤水光唇膏 - 01 Bare Rose 2g","price":299,"origPrice":360},
  {"name":"heme 舒芙蕾唇頰霜 - 01 Bubble Pink 3.5g","price":299,"origPrice":360},
  {"name":"heme 舒芙蕾唇頰霜 - 02 Cream Rose 3.5g","price":299,"origPrice":360},
  {"name":"heme 舒芙蕾唇頰霜 - 03 Fig Mousse 3.5g","price":299,"origPrice":360},
  {"name":"VISEE光誘恆吻唇膏 N 851","price":380,"origPrice":null},
  {"name":"VISEE光誘恆吻唇膏 N 350","price":380,"origPrice":null},
  {"name":"VISEE光誘恆吻唇膏 N 850","price":380,"origPrice":null},
  {"name":"VISEE光誘恆吻唇膏 N 450","price":380,"origPrice":null},
  {"name":"VISEE光誘恆吻唇膏 N 351","price":380,"origPrice":null},
  {"name":"VISEE光誘恆吻唇膏 N 852","price":380,"origPrice":null},
  {"name":"VISEE光誘恆吻唇膏 N 352","price":380,"origPrice":null},
  {"name":"VISEE光誘恆吻唇膏 N 650","price":380,"origPrice":null},
  {"name":"MAYBELLINE媚比琳泰迪絨霧液態唇泥 100 絨絨伯爵奶","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳泰迪絨霧液態唇泥 120 絨絨莓果奶","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳泰迪絨霧液態唇泥 125 絨絨杏仁奶","price":424,"origPrice":499},
  {"name":"ETUDE 絲絨慕斯軟唇泥 05 慵懶果茶","price":359,"origPrice":400},
  {"name":"ETUDE 絲絨慕斯軟唇泥 02 心動蜜桃","price":359,"origPrice":400},
  {"name":"ETUDE 絲絨慕斯軟唇泥 06 莓果心事","price":359,"origPrice":400},
  {"name":"ETUDE 絲絨慕斯軟唇泥 03 粉紅香檳","price":359,"origPrice":400},
  {"name":"ETUDE 絲絨慕斯軟唇泥 01 微甜裸粉","price":359,"origPrice":400},
  {"name":"凱婷 怪獸級持色唇膏 19","price":339,"origPrice":430},
  {"name":"凱婷 怪獸級持色唇膏 18","price":339,"origPrice":430},
  {"name":"凱婷 怪獸級持色唇膏 20","price":339,"origPrice":430},
  {"name":"凱婷 怪獸級持色水晶唇露 CP03","price":339,"origPrice":430},
  {"name":"凱婷 怪獸級持色水晶唇露 CP01","price":339,"origPrice":430},
  {"name":"凱婷 怪獸級持色水晶唇露 CP02","price":339,"origPrice":430},
  {"name":"heme 持色水光唇釉-07 Muhly Pink","price":299,"origPrice":360},
  {"name":"heme 持色水光唇釉-08 Mild Peach","price":299,"origPrice":360},
  {"name":"媚比琳水嘟嘟蜜光潤唇膏 04嘟嘟櫻桃","price":373,"origPrice":439},
  {"name":"媚比琳水嘟嘟蜜光潤唇膏 05嘟嘟白桃","price":373,"origPrice":439},
  {"name":"媚比琳水嘟嘟蜜光潤唇膏 07嘟嘟野莓","price":373,"origPrice":439},
  {"name":"媚比琳水嘟嘟蜜光潤唇膏 03嘟嘟玫瑰","price":373,"origPrice":439},
  {"name":"媚比琳水嘟嘟蜜光潤唇膏 02嘟嘟裸粉","price":373,"origPrice":439},
  {"name":"媚比琳水嘟嘟蜜光潤唇膏 06嘟嘟焦糖","price":373,"origPrice":439},
  {"name":"heme 唇線筆 - 11 Bright Apricot 0.6g","price":199,"origPrice":240},
  {"name":"heme 唇線筆 - 10 Plump Pink 0.6g","price":199,"origPrice":240},
  {"name":"heme 唇線筆 - 00 Shading Beige 0.6g","price":199,"origPrice":240},
  {"name":"凱婷 怪獸級持色唇膏（水光） G04","price":339,"origPrice":430},
  {"name":"凱婷 怪獸級持色唇膏（水光） G05","price":339,"origPrice":430},
  {"name":"MAYBELLINE媚比琳超持久霧感液態唇膏 540 空中花園","price":366,"origPrice":430},
  {"name":"MAYBELLINE媚比琳超持久霧感液態唇膏 545 中央公園","price":366,"origPrice":430},
  {"name":"凱婷 怪獸級持色唇膏（水光） G01","price":339,"origPrice":430},
  {"name":"凱婷 怪獸級持色唇膏（水光） G02","price":339,"origPrice":430},
  {"name":"凱婷 怪獸級持色唇膏（水光） G03","price":339,"origPrice":430},
  {"name":"凱婷 怪獸級持色唇膏 15","price":339,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色絨霧唇釉 M05","price":366,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色絨霧唇釉 M04","price":366,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色絨霧唇釉 M02","price":366,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色絨霧唇釉 M01","price":366,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色唇膏 05乾燥無花果","price":339,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色唇膏 09緋紅水晶球","price":339,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色唇膏 08藕色微雨","price":339,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色唇膏 07荊棘玫瑰","price":339,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色唇膏 06深夜邂逅","price":339,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色唇膏 03暖陽奶茶","price":339,"origPrice":430},
  {"name":"KATE凱婷 怪獸級持色唇膏 02甜潤果紅","price":339,"origPrice":430},
  {"name":"雪芙蘭膠原蛋白豐潤護唇膏薔薇霧紅","price":99,"origPrice":null},
  {"name":"雪芙蘭膠原蛋白豐潤護唇膏玫瑰嬌紅","price":99,"origPrice":null},
  {"name":"雪芙蘭膠原蛋白豐潤護唇膏-微醺蜜桃","price":99,"origPrice":null},
  {"name":"雪芙蘭膠原蛋白豐潤護唇膏-暖珊瑚色","price":99,"origPrice":null},
  {"name":"Sebamed施巴 pH5.5防曬保濕護唇膏 SPF30","price":220,"origPrice":null},
  {"name":"CLIO珂莉奧 水晶糖心光潤唇釉 26沁玫櫻桃-櫻桃限定版","price":442,"origPrice":520},
  {"name":"CLIO珂莉奧 嫩顏柔霧唇頰凍 04杏桃奶霜","price":493,"origPrice":580},
  {"name":"CLIO珂莉奧 水晶糖心光潤唇釉 27暖漾櫻桃-櫻桃限定版","price":442,"origPrice":520},
  {"name":"CLIO珂莉奧 嫩顏QQ唇頰凍迷你版 03烏龍奶凍","price":323,"origPrice":380},
  {"name":"CLIO珂莉奧 水晶糖心光潤唇釉 28乾燥櫻桃-櫻桃限定版","price":442,"origPrice":520},
  {"name":"CLIO珂莉奧 嫩顏柔霧唇頰凍 06烤糖奶霜","price":493,"origPrice":580},
  {"name":"CLIO珂莉奧 嫩顏QQ唇頰凍迷你版 02櫻花奶凍","price":323,"origPrice":380},
  {"name":"CLIO珂莉奧 嫩顏QQ唇頰凍迷你版 01蜜桃奶凍","price":323,"origPrice":380},
  {"name":"Laka 果然保濕潤唇蜜 ［710Cherish］","price":480,"origPrice":500},
  {"name":"Laka 果然保濕潤唇蜜 ［706Stealer］","price":480,"origPrice":500},
  {"name":"Laka 果然保濕潤唇蜜［701Dolly］","price":480,"origPrice":500},
  {"name":"Laka 果然保濕潤唇蜜 ［703 Apri］","price":480,"origPrice":500},
  {"name":"Laka 果然保濕潤唇蜜［702 Melts］","price":480,"origPrice":500},
  {"name":"Laka 果然保濕潤唇蜜 ［704 Ruddy］","price":480,"origPrice":500},
  {"name":"OPERA OPERA渲漾水色唇膏N-05珊瑚 3.6g","price":360,"origPrice":380},
  {"name":"OPERA OPERA渲漾水色唇膏光澤系禮盒-408星耀紅/409月光米","price":798,"origPrice":840},
  {"name":"media媚點 水灩光唇膏 BE-02","price":272,"origPrice":320},
  {"name":"media媚點 水灩光唇膏 PK-05","price":272,"origPrice":320},
  {"name":"media媚點 水灩光唇膏 RD-06","price":272,"origPrice":320},
  {"name":"CLIO珂莉奧 嫩顏QQ唇頰凍 02櫻花奶凍","price":493,"origPrice":580},
  {"name":"CLIO珂莉奧 嫩顏QQ唇頰凍 01蜜桃奶凍","price":493,"origPrice":580},
  {"name":"CLIO珂莉奧 嫩顏QQ唇頰凍 03烏龍奶凍","price":493,"origPrice":580},
  {"name":"CLIO珂莉奧 水晶糖心光潤唇釉 11 輕甜無花果","price":442,"origPrice":520},
  {"name":"CLIO珂莉奧 水晶糖心光潤唇釉 19暖澄蘋果-蘋果限定版","price":442,"origPrice":520},
  {"name":"CLIO珂莉奧 水晶糖心光潤唇釉 20太妃蘋果-蘋果限定版","price":442,"origPrice":520},
  {"name":"CLIO珂莉奧 水晶糖心光潤唇釉 18冰糖蘋果-蘋果限定版","price":442,"origPrice":520},
  {"name":"CLIO珂莉奧 晶透緞光水唇膏 06蜜香無花果","price":442,"origPrice":520},
  {"name":"CLIO珂莉奧 晶透緞光水唇膏 04蜜光蘋香","price":442,"origPrice":520},
  {"name":"CLIO珂莉奧 水晶糖心光潤唇釉01 蜜香蘋果","price":260,"origPrice":520},
  {"name":"CLIO珂莉奧 水晶糖心光潤唇釉06 粉黛玫瑰","price":442,"origPrice":520},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 275 玫瑰可麗露","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 280 薔薇馬卡龍","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 215針織暖橘棕","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 220毛呢磚酒紅","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 105微燻蜜柚","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 230煙燻皮革棕","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 68 蜜桃蝴蝶結","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 66 甜粉澎澎裙","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 130重焙赤茶","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 125淺焙木玫","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 65糖霜草莓熊","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 60水蜜桃炸彈","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久水光鎖吻唇釉 61軟萌泰迪橘","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳泰迪絨霧液態唇泥 60 玫瑰茶泰迪","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳泰迪絨霧液態唇泥 25 蜜桃絨泰迪","price":424,"origPrice":499},
  {"name":"MAYBELLINE媚比琳超持久霧感液態唇膏 540 空中花園","price":366,"origPrice":430},
  {"name":"MAYBELLINE媚比琳超持久霧感液態唇膏 545 中央公園","price":366,"origPrice":430},
  {"name":"MAYBELLINE媚比琳 超持久霧感液態唇膏 175 美術館","price":366,"origPrice":430},
  {"name":"MAYBELLINE媚比琳超持久霧感液態唇膏 117 帝國大廈","price":366,"origPrice":430},
  {"name":"MAYBELLINE媚比琳超持久霧感液態唇膏 118 百老匯","price":366,"origPrice":430},
  {"name":"MAYBELLINE媚比琳超持久霧感液態唇膏 130 第五大道","price":366,"origPrice":430},
  {"name":"MAYBELLINE媚比琳超持久霧感液態唇膏 210 自由女神","price":366,"origPrice":430},
  {"name":"heme 持色水光唇釉 - 06 Syrup Brown 2.5ml","price":299,"origPrice":360},
  {"name":"heme 持色水光唇釉 - 04 Honey Nude 2.5ml","price":299,"origPrice":360},
  {"name":"heme 持色水光唇釉 - 02 Berry Plum 2.5ml","price":299,"origPrice":360},
  {"name":"heme 持色水光唇釉 - 03 Rose Beige 2.5ml","price":299,"origPrice":360},
  {"name":"heme 持色水光唇釉 - 01 Pansy Pink 2.5ml","price":299,"origPrice":360},
  {"name":"heme 持色水光唇釉 - 05 Fresh Tulip 2.5ml","price":299,"origPrice":360},
  {"name":"ettusais艾杜紗 東京輕吻染唇膏 13","price":442,"origPrice":520},
  {"name":"ettusais艾杜紗 東京輕吻染唇膏 12","price":442,"origPrice":520},
  {"name":"ettusais艾杜紗 東京輕吻染唇膏06/2g","price":442,"origPrice":520},
  {"name":"ettusais艾杜紗 東京輕吻染唇膏 05","price":442,"origPrice":520},
  {"name":"ettusais艾杜紗 東京輕吻染唇膏04/2g","price":442,"origPrice":520},
  {"name":"ettusais艾杜紗 東京輕吻染唇膏R02","price":442,"origPrice":520},
  {"name":"ettusais艾杜紗 一抹潤澤護唇精華 10g","price":399,"origPrice":469},
  {"name":"雪芙蘭極致水潤保濕護唇膏-水漾4g","price":99,"origPrice":null},
  {"name":"雪芙蘭極致水潤保濕護唇膏-濃潤4g","price":99,"origPrice":null},
  {"name":"雪芙蘭極致水潤保濕護唇膏-修護4g","price":99,"origPrice":null},
  {"name":"NIVEA妮維雅 5D玻尿酸修護精華潤唇膏-裸透玫瑰","price":199,"origPrice":null},
  {"name":"NIVEA妮維雅 5D玻尿酸修護精華潤唇膏-透明無色","price":199,"origPrice":null},
  {"name":"NIVEA妮維雅香榭紅唇親吻護唇膏-熔岩玫瑰紅","price":189,"origPrice":null},
  {"name":"NIVEA妮維雅超能防曬護唇膏SPF50","price":169,"origPrice":null},
  {"name":"NIVEA妮維雅潤澤修護護唇膏4.8g","price":169,"origPrice":null},
  {"name":"NIVEA妮維雅 極致保濕護唇膏4.8g","price":169,"origPrice":null},
  {"name":"NIVEA妮維雅水漾護唇膏4.8g","price":169,"origPrice":null},
  {"name":"曼秀雷敦集中修護潤唇膏-薄荷","price":199,"origPrice":null},
  {"name":"曼秀雷敦集中修護潤唇膏-無香料","price":199,"origPrice":null},
  {"name":"曼秀雷敦Water Color水彩潤唇膏-柔暮棕","price":145,"origPrice":170},
  {"name":"Mentholatum曼秀雷敦Water Color水彩潤唇膏-閃耀紅","price":145,"origPrice":170},
  {"name":"Mentholatum曼秀雷敦Water Color水彩潤唇膏-甜戀粉","price":145,"origPrice":170},
  {"name":"Mentholatum曼秀雷敦Water Color水彩潤唇膏-暖陽橙","price":145,"origPrice":170},
  {"name":"Mentholatum曼秀雷敦 深層保濕潤唇膏-清新香檸","price":159,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 頂級濃潤柔霜潤唇膏-清甜柚香","price":199,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 頂級濃潤柔霜潤唇膏-杏仁牛奶","price":199,"origPrice":null},
  {"name":"護唇膏-Mentholatum曼秀雷敦 頂級濃潤柔霜潤唇膏-無香料","price":199,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 Lip Pure純淨植物潤唇膏-香橙","price":175,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 Magic Color粉漾變色潤脣膏-玫瑰粉","price":159,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 Magic Color粉漾變色潤唇膏-珊瑚橙","price":159,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 Magic Color粉漾變色潤脣膏-蜜桃粉","price":159,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 深層保濕潤唇膏-無香料4.5g","price":159,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 深層保濕潤唇膏-薄荷4.5g","price":159,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 薄荷潤唇凍膏","price":140,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 水份潤唇膏-無香料3.5g","price":135,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 水份潤唇膏-薄荷3.5g","price":135,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦薄荷修護潤唇膏（隨機出貨）","price":135,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 Jelle Soft輕柔恬漾潤唇凍膏-玻尿酸","price":140,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 Jelle Soft輕柔恬漾潤唇凍膏-維他命","price":140,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 Jelle Soft輕柔恬漾潤唇凍膏-Q10","price":140,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 Lip Pure純淨植物潤唇膏-無香料","price":175,"origPrice":null},
  {"name":"Mentholatum曼秀雷敦 Lip Pure純淨植物潤唇膏-佛手柑","price":149,"origPrice":175},
  {"name":"Vaseline凡士林 全能精華潤唇膏 舒緩修護 1.8G","price":199,"origPrice":265},
  {"name":"Vaseline凡士林 全能精華潤唇膏 淡紋彈潤 1.8G","price":199,"origPrice":265},
  {"name":"凡士林全能精華潤唇膏 煥亮潤色 1.8G","price":199,"origPrice":265},
  {"name":"凡士林全能精華潤唇膏 柔嫩磨砂 1.8G","price":199,"origPrice":265},
  {"name":"Vaseline凡士林 玫瑰潤色護唇膏4.8g","price":89,"origPrice":139},
  {"name":"Vaseline凡士林 經典原味護唇膏4.8g","price":89,"origPrice":139},
  {"name":"Vaseline凡士林 原味瓶裝護脣膏7g","price":89,"origPrice":99},
  {"name":"Vaseline凡士林 玫瑰護唇膏瓶裝7g","price":89,"origPrice":99},
  {"name":"Sebamed施巴 嬰兒護唇膏","price":220,"origPrice":null},
  {"name":"DHC純欖護唇膏1.5g","price":199,"origPrice":350},
  {"name":"1028 B5極致護理滋潤護唇膏 無香料","price":110,"origPrice":220},
  {"name":"1028 B5極致護理滋潤護唇膏 檸檬","price":110,"origPrice":220},
  {"name":"1028 B5極致護理滋養唇膜 無香料","price":115,"origPrice":230},
  {"name":"1028 B5極致護理滋養唇膜 檸檬","price":115,"origPrice":230},
  {"name":"1028 奢絨緞光訂製唇膏 04 烤栗奶","price":298,"origPrice":350},
  {"name":"1028 奢絨緞光訂製唇膏 03 蜜糖紅","price":298,"origPrice":350},
  {"name":"1028 奢絨緞光訂製唇膏 02 太妃茶","price":298,"origPrice":350},
  {"name":"1028 雙管齊下柔霧唇線筆 03 暖玫瑰","price":230,"origPrice":270},
  {"name":"1028 雙管齊下柔霧唇線筆 01 大地裸","price":230,"origPrice":270},
  {"name":"1028 極潤光奶霜唇膏（613 蜜糖莓）","price":229,"origPrice":350},
  {"name":"CEZANNE CEZANNE 修飾大師唇線筆 021-01 0.25G","price":255,"origPrice":null},
  {"name":"colorgram可麗格朗 完美輪廓雙頭唇線筆-05冷調玫瑰","price":360,"origPrice":null},
  {"name":"colorgram可麗格朗 完美輪廓雙頭唇線筆-02低調裸粉","price":360,"origPrice":null},
  {"name":"colorgram可麗格朗 完美輪廓雙頭唇線筆-03蜜桃米膚","price":360,"origPrice":null},
  {"name":"SEBA MED 施巴 施巴亮色護唇膏SPF30/4.8g-西瓜清甜","price":169,"origPrice":220}
];

// ── 正規化比對函式 ──
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/maybelline|媚比琳/g, 'maybelline')
    .replace(/kate|凱婷/g, 'kate')
    .replace(/heme|喜蜜/g, 'heme')
    .replace(/seba med|sebamed|施巴/g, 'seba')
    .replace(/[（(]/g, '(')
    .replace(/[）)]/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTokens(name) {
  return normalizeName(name)
    .split(/[\s\-_\/,]+/)
    .filter(t => t.length > 1 && !/^\d+(\.\d+)?(g|ml|mg)$/.test(t));
}

function similarity(nameA, nameB) {
  const tokA = new Set(getTokens(nameA));
  const tokB = new Set(getTokens(nameB));
  const intersection = [...tokA].filter(t => tokB.has(t)).length;
  const minLen = Math.min(tokA.size, tokB.size);
  return minLen > 0 ? intersection / minLen : 0;
}

function extractBrand(name) {
  if (/^3CE/i.test(name)) return '3CE';
  if (/kate|凱婷/i.test(name)) return 'KATE';
  if (/maybelline|媚比琳/i.test(name)) return 'MAYBELLINE';
  if (/heme|喜蜜/i.test(name)) return 'HEME';
  if (/雪芙蘭/i.test(name)) return '雪芙蘭';
  if (/seba|施巴/i.test(name)) return 'SEBA MED';
  if (/opera/i.test(name)) return 'OPERA';
  if (/clio|珂莉奧/i.test(name)) return 'CLIO';
  if (/etude/i.test(name)) return 'ETUDE';
  if (/nivea|妮維雅/i.test(name)) return 'NIVEA';
  if (/vaseline|凡士林/i.test(name)) return 'VASELINE';
  if (/mentholatum|曼秀雷敦/i.test(name)) return '曼秀雷敦';
  if (/laka/i.test(name)) return 'Laka';
  if (/visee/i.test(name)) return 'VISEE';
  if (/media|媚點/i.test(name)) return 'MEDIA';
  if (/cezanne/i.test(name)) return 'CEZANNE';
  if (/1028/i.test(name)) return '1028';
  if (/colorgram|可麗格朗/i.test(name)) return 'COLORGRAM';
  if (/ettusais|艾杜紗/i.test(name)) return 'ETTUSAIS';
  if (/dhc/i.test(name)) return 'DHC';
  const parts = name.trim().split(/\s+/);
  return parts[0];
}

// ── 讀取現有 products ──
const existingProducts = db.prepare('SELECT id, name FROM products').all();

const insertPrice = db.prepare(`
  INSERT INTO price_records (id, product_id, platform, price, original_price, discount_label, in_stock)
  VALUES (@id, @productId, 'cosmed', @price, @origPrice, @discountLabel, 1)
`);
const insertProduct = db.prepare(`
  INSERT INTO products (id, name, brand, category, emoji, is_active)
  VALUES (@id, @name, @brand, @category, @emoji, 1)
`);

let matched = 0, added = 0;
const matchLog = [], addLog = [];

const run = db.transaction(() => {
  for (const item of cosmedData) {
    let bestScore = 0, bestProduct = null;
    for (const ep of existingProducts) {
      const score = similarity(item.name, ep.name);
      if (score > bestScore) { bestScore = score; bestProduct = ep; }
    }

    const THRESHOLD = 0.65;
    if (bestScore >= THRESHOLD && bestProduct) {
      insertPrice.run({
        id: uuidv4(),
        productId: bestProduct.id,
        price: item.price,
        origPrice: item.origPrice,
        discountLabel: item.origPrice && item.price < item.origPrice ? '售價已折' : null
      });
      matchLog.push(`[比對] ${item.name.slice(0,30)} → ${bestProduct.name.slice(0,30)} (${(bestScore*100).toFixed(0)}%)`);
      matched++;
    } else {
      const productId = uuidv4();
      insertProduct.run({
        id: productId, name: item.name, brand: extractBrand(item.name),
        category: '唇膏', emoji: '💄'
      });
      insertPrice.run({
        id: uuidv4(), productId, price: item.price,
        origPrice: item.origPrice,
        discountLabel: item.origPrice && item.price < item.origPrice ? '售價已折' : null
      });
      existingProducts.push({ id: productId, name: item.name });
      addLog.push(`[新增] ${item.name.slice(0,40)}`);
      added++;
    }
  }
});

run();

console.log(`\n比對到相同商品（新增 cosmed 價格）: ${matched} 筆`);
console.log(`全新商品（新增至資料庫）: ${added} 筆`);
matchLog.forEach(l => console.log(' ', l));

const total = db.prepare('SELECT COUNT(*) as c FROM products').get();
const priceTotal = db.prepare('SELECT COUNT(*) as c FROM price_records').get();
console.log(`\n目前 products 總計: ${total.c} 筆`);
console.log(`目前 price_records 總計: ${priceTotal.c} 筆`);

const bothPlatforms = db.prepare(`
  SELECT p.name,
    MAX(CASE WHEN pr.platform='watsons' THEN pr.price END) as wp,
    MAX(CASE WHEN pr.platform='cosmed'  THEN pr.price END) as cp
  FROM products p
  JOIN price_records pr ON pr.product_id = p.id
  GROUP BY p.id
  HAVING wp IS NOT NULL AND cp IS NOT NULL
`).all();

console.log(`\n── 同時有屈臣氏＋康是美的商品 (${bothPlatforms.length} 筆) ──`);
bothPlatforms.forEach(r => {
  const diff = r.wp - r.cp;
  const mark = diff > 0 ? `康是美較便宜 $${diff}` : diff < 0 ? `屈臣氏較便宜 $${Math.abs(diff)}` : '同價';
  console.log(`  ${r.name.slice(0,38).padEnd(38)} 屈$${r.wp} vs 康$${r.cp}  [${mark}]`);
});
