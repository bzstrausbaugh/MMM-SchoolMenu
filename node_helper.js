var NodeHelper = require('node_helper');
var undici = require('undici');
var dayjs = require('dayjs');
var isoWeek = require('dayjs/plugin/isoWeek');
var { unique } = require('radash');

dayjs.extend(isoWeek);

const extractEntreFoodItemsForDay = (menuItems) => {
  const dailyItems = [
    'turkey & cheese',
    'sun butter & jelly',
    'turkey-ham & cheese',
  ];
  const groups = [];
  let group = [];
  for (let i = 0; i < menuItems.length; i++) {
    const menuItem = menuItems[i];
    if (menuItem.is_section_title) {
      if (i > 0) {
        groups.push(group);
        group = [];
      }
      continue;
    } else {
      group.push(menuItem);
    }
  }
  groups.push(group);
  return groups[0];
};

const allLackFood = (day) => {
  return day.menu_items.filter((item) => item.food !== null).length === 0;
};

const getMenuForWeek = async (startOfWeek) => {
  //pcsd202.api.nutrislice.com/menu/api/weeks/school/wallin-oaks-elementary-school/menu-type/lunch/2026/08/09/
  https: return new Promise((resolve, reject) => {
    const menuUrl = `https://pcsd202.api.nutrislice.com/menu/api/weeks/school/wallin-oaks-elementary-school/menu-type/lunch/${startOfWeek.format('YYYY')}/${startOfWeek.format('MM')}/${startOfWeek.format('DD')}`;
    undici
      .request(menuUrl, {
        method: 'GET',
      })
      .then((menuResponse) => {
        if (menuResponse.statusCode > 299) {
          throw new Error('unable to get menu');
        }
        return menuResponse.body;
      })
      .then((menuBody) => menuBody.json())
      .then((menu) => {
        const dailyItems = [
          'turkey & cheese',
          'sun butter & jelly',
          'turkey-ham & cheese',
        ];
        const menuDays = menu.days
          .filter((day) => dayjs(day.date).isoWeekday() < 6)
          .filter(
            (day) =>
              day.menu_items.length > 0 || day.is_holiday || allLackFood(day),
          )
          .map((menuDay) => {
            if (
              menuDay.is_holiday ||
              (menuDay.menu_items.length > 0 && allLackFood(menuDay))
            ) {
              return { date: menuDay.date, holiday: true, items: [] };
            } else {
              const items = unique(
                extractEntreFoodItemsForDay(menuDay.menu_items),
                (i) => i.food?.name,
              ).filter(
                (item) =>
                  item.food &&
                  !item.food.name.toLowerCase().includes(dailyItems[0]) &&
                  !item.food.name.toLowerCase().includes(dailyItems[1]) &&
                  !item.food.name.toLowerCase().includes(dailyItems[2]),
              );
              return {
                date: menuDay.date,
                holiday: false,
                items,
              };
            }
          });
        resolve(menuDays);
      })
      .catch((error) => reject(error));
  });
};

module.exports = NodeHelper.create({
  start: function () {
    console.log('MMM-SchoolMenu helper, started...');
  },

  getWeeklyMenu: function (payload) {
    var _this = this;
    const thisWeek = dayjs().startOf('week');
    const nextWeek = thisWeek.add(1, 'week');

    Promise.all([getMenuForWeek(thisWeek), getMenuForWeek(nextWeek)]).then(
      (menus) => {
        _this.sendSocketNotification('GOT_WEEKLY_MENUS', {
          thisWeek: {
            weekOf: `${thisWeek.day(1).format('MM/DD')} - ${thisWeek
              .day(1)
              .add(5, 'd')
              .format('MM/DD')}`,
            menu: menus[0],
          },
          nextWeek: {
            weekOf: `${nextWeek.day(1).format('MM/DD')} - ${nextWeek
              .day(1)
              .add(5, 'd')
              .format('MM/DD')}`,
            menu: menus[1],
          },
        });
      },
    );
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'GET_WEEKLY_MENUS') {
      this.getWeeklyMenu(payload);
    }
  },
});
