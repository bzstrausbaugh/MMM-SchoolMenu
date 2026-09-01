var NodeHelper = require('node_helper');
var undici = require('undici');
var dayjs = require('dayjs');
var { unique } = require('radash');

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
          .filter(
            (day) =>
              day.menu_items.length > 0 ||
              day.is_holiday ||
              (day.menu_items.length === 1 && day.menu_items[0].food === null),
          )
          .map((menuDay) => {
            if (
              menuDay.is_holiday ||
              (menuDay.menu_items.length === 1 &&
                menuDay.menu_items[0].food === null)
            ) {
              return { date: menuDay.date, holiday: true, items: [] };
            } else {
              return {
                date: menuDay.date,
                holiday: false,
                items: unique(
                  menuDay.menu_items.filter((item) => item.station_id === null),
                  (i) => i.food.name,
                ).filter(
                  (item) =>
                    !item.food.name.toLowerCase().includes(dailyItems[0]) &&
                    !item.food.name.toLowerCase().includes(dailyItems[1]) &&
                    !item.food.name.toLowerCase().includes(dailyItems[2]),
                ),
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
