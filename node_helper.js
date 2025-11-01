var NodeHelper = require('node_helper');
var undici = require('undici');
var dayjs = require('dayjs');

const getMenuForWeek = async (locationId, startOfWeek) => {
  return new Promise((resolve, reject) => {
    const url = `https://psd202.schooldish.com/api/menu/GetMenuPeriods?locationId=${locationId}&storeId=&date=${startOfWeek.format(
      'MM/DD/YYYY'
    )}&mode=Weekly`;
    console.log('URL', url);
    undici
      .request(url, {
        method: 'GET',
      })
      .then((periodsResponse) => {
        if (periodsResponse.statusCode > 299) {
          throw new Error('unable to get menu periods');
        }
        return periodsResponse.body;
      })
      .then((periodsBody) => periodsBody.json())
      .then((periods) => {
        const lunchPeriod = periods.Result.filter(
          (period) => period.PeriodName === 'Lunch'
        );
        if (lunchPeriod.length > 0) {
          undici
            .request(
              `https://psd202.schooldish.com/api/menu/GetMenus?locationId=${locationId}&storeIds=&mode=Weekly&date=${startOfWeek.format(
                'MM/DD/YYYY'
              )}&time=&periodId=${lunchPeriod[0].PeriodId}&fulfillmentMethod=`
            )
            .then((menuResponse) => {
              if (menuResponse.statusCode > 299) {
                throw new Error('error getting lunch menu');
              }
              return menuResponse.body;
            })
            .then((menuBody) => menuBody.json())
            .then((menu) => {
              const menuResult = [];
              const entreeStations = menu.Menu?.MenuStations?.filter(
                (station) =>
                  (station.Name === 'Entree' || station.Name === 'Grill') &&
                  station.PeriodId === lunchPeriod[0].PeriodId + ''
              );
              const menuMap = new Map();
              if (entreeStations && entreeStations.length > 0) {
                entreeStations.forEach((entryStation) => {
                  menu.Menu?.MenuProducts?.filter(
                    (menuProduct) =>
                      menuProduct.StationId === entryStation.StationId
                  ).forEach((menuItem) => {
                    if (!menuMap.has(menuItem.AssignedDate)) {
                      menuMap.set(menuItem.AssignedDate, []);
                    }
                    menuMap
                      .get(menuItem.AssignedDate)
                      .push(menuItem.Product.MarketingName);
                  });
                });
                menuMap.forEach((value, key) => {
                  menuResult.push({ date: key, items: value });
                });
                menuResult.sort(
                  (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
                );
              }
              resolve(menuResult);
            });
        } else {
          throw Error('no lunch period found');
        }
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
    const monday = thisWeek.day(1);
    const nextMonday = thisWeek.day(8);

    Promise.all([
      getMenuForWeek(payload.locationId, monday),
      getMenuForWeek(payload.locationId, nextMonday),
    ]).then((menus) => {
      _this.sendSocketNotification('GOT_WEEKLY_MENUS', {
        thisWeek: {
          weekOf: `${monday.format('MM/DD')} - ${thisWeek
            .add(5, 'd')
            .format('MM/DD')}`,
          menu: menus[0],
        },
        nextWeek: {
          weekOf: `${nextMonday.format('MM/DD')} - ${nextMonday
            .add(5, 'd')
            .format('MM/DD')}`,
          menu: menus[1],
        },
      });
    });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'GET_WEEKLY_MENUS') {
      this.getWeeklyMenu(payload);
    }
  },
});
