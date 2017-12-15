delete from notes where note_id in ('FfZylYxt','HqzAEsR2fFEZ','KgTQDh67+1Mh','TKMbAYl0AFyQ','W+bGM185c6gw',
                                    'YXBdhv4dYKMy','aF4/6p1zTpIS','nsLnrrDktl/s','wkhFImoPuxky');

delete from notes_tree where note_tree_id in ('TTy5N2y2S6JP','TTkL3rWDexpp','TTEhtomZekUk','TTvP7zW01zwg','TTuYmMTZyKRt'
  ,'TToaClamxbBF','TTKvNCe5X2dj','TTE7jFx5A0zW','TTc79bscyrHX','TTcw8ZyDy2Cc','TTdFzAOWA9hZ','TTUyVLqyIvVg','TTy85NKSBDyO'
  ,'TTCyuireAWBv','TTDpVyuzbj1a','TTYznrYvAeIs','TTocvv15VMyu','TTjtxQkBT5vj','TToyyRzbBF0T','TTFt8NE9vSyZ','TTfzFZOuuDqv'
  ,'TT2e2oUYcxG6','TToXselUpPAy','TTEM68gGukg0','TTkZxxwtUOzW','TTAZNxBtgmmh','TTK1YErdBE3x','TTzjKiEf54o6','TTPWd5Ou1xET'
  ,'TTxQtjf22rTL','TTJAGaI4c89V','TTUQmsxSTdV3','TTGAOf5Lvr6b','TTECSDRN4ZPW','TTZZXLiGNWv4','TTxSLphulRct','TT8vld7x0qWF'
  ,'TTuuxXnv2Kpw','TT3RkLZ9AI6t','TTuEbI4Cj3qC','TT4CXXRyWRqm','TTQCuFgnMqxX','TTxnDEMz1bd4','TTMOnqhBesjs','TTHblx55gRHN'
  ,'TTMHW8HIGCjR','TTxzg3qqyLjw','TTluvD7yS8Rv','TT88qK2j3ggk','TTF7oHhS5ANF','TTOH275JiUSy','TToIt2dQ5tYH','TTBPgixQgbAq'
  ,'TTeN46707CJl','TTDb3GC2y6nN','TTlIXFwpICko','TTE6M9AxLh2U','TTjqhB8zXjD6','TT9NPeLg4FjK','TTj12jDX7TM3','TTPRjf7EdvDX'
  ,'TTBnu09pxOmn','TTZxyAkJQ9Cf','TTlvqeof2IBS','TT5R5xtIqRQf','TTiiD6hFjlVH','TTNVjGHSqNgo','TTrORSHCsAVQ','TT5Ei5fngqkv'
  ,'TTQ4hdpcIX3C','TTQgxq4CoiHU','TTJayLjI6BSE','TTYyraNy0CVT','TTnAJ3AK3wHz','TTJwKcgs1s0X','TT4FiatgbLEs','TTEdp5Zx1n5F');

update notes_tree set is_deleted = 1 where note_tree_id in ('TTiaU9xqnrca','TTQAy9c1vDId','TTHXWBJB2Y24','TTDV8DUK2IZA'
  ,'TTI5JHODZYV5','TTBEZ8TMSJV4','TT1MDWZXE8ZI','TTJV7ZOA8907','TTUGE6N99QSO','TTN0OS17T0KM');

delete from notes_history where note_history_id in ('KHAp5viTrrOfugzQ', 'xmhaS76piZn0QGzn', '25aL96ke8xmud9Bt');