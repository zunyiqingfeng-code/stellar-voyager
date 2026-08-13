/* 星海远航 · 名称生成器 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  const PREFIX = ['天', '北', '南', '太', '紫', '玉', '参', '毕', '心', '尾', '角', '亢',
    '氐', '房', '箕', '牛', '女', '虚', '危', '室', '壁', '奎', '娄', '胃', '昴', '觜', '井', '鬼', '柳', '星', '张', '翼', '轸',
    '辰', '曜', '玄', '苍', '赤', '白', '黄', '幽', '明', '昭', '华', '元', '始', '归', '启', '长', '崇', '显', '永', '和'];
  const SUFFIX = ['垣', '宿', '宫', '阙', '极', '衡', '枢', '光', '庭', '府', '台', '纪',
    '野', '门', '关', '津', '渡', '海', '河', '川', '泽', '陵', '丘', '峰', '渊', '冥', '虚', '垣', '仪', '衡', '微', '曜'];

  const PLANET_WORD = ['荒原', '裂谷', '沙海', '冰原', '风暴', '翠野', '深洋', '赤谷', '灰烬', '迷雾',
    '熔流', '极光', '群青', '晨曦', '永夜', '光轮', '琥珀', '碧波', '雪线', '雷鸣'];
  const GAS_WORD = ['气海', '巨涡', '朱斑', '云帆', '环宇', '风暴眼', '氦涛', '流岚'];

  const PIRATE_A = ['血颅', '晶尘', '掠日', '黑帆', '噬星', '烬灭', '虚渊', '赤潮', '碎星', '荒芜', '铁喙', '幽火', '断脊', '蚀骨', '残光'];
  const PIRATE_B = ['掠夺者', '海盗团', '掠袭舰队', '流寇', '私掠团', '劫掠者', '亡命舰队'];

  const SHIP_A = ['无畏', '黎明', '远航', '苍蓝', '裁决', '曙光', '守望', '破晓', '极星', '逐日', '天火', '砺刃', '永耀', '孤胆', '赤诚', '风行者'];
  const SHIP_B = ['号', '者', '之心', '之魂', '之翼', '誓言'];

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  const Names = {
    system(r) { return r.pick(PREFIX) + r.pick(SUFFIX); },
    planet(r, sysName, idx, isGas) {
      if (idx === 0) return sysName + '·母星';
      const w = isGas ? r.pick(GAS_WORD) : r.pick(PLANET_WORD);
      return sysName + '·' + ROMAN[Math.min(idx, ROMAN.length - 1)] + ' ' + w;
    },
    moon(r, planetName, idx) { return planetName + ' 卫' + ROMAN[Math.min(idx, ROMAN.length - 1)]; },
    pirateFaction(r) { return r.pick(PIRATE_A) + r.pick(PIRATE_B); },
    ship(r) { return r.pick(SHIP_A) + r.pick(SHIP_B); },
    pilot(r) { return r.pick(PIRATE_A) + '·' + r.pick(['上尉', '统领', '舰长', '军阀', '女妖', '狂徒', '屠夫']); }
  };

  S.Names = Names;
})(typeof window !== 'undefined' ? window : globalThis);
