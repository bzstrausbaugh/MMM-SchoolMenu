function updateMenus(payload) {
  let thisWeekDiv = document.getElementById('thisweek');
  const header1 = document.createElement('div');
  header1.id = `week-0`;
  header1.classList.add('header');
  header1.innerHTML = `Week of ${payload.thisWeek.weekOf}`;
  thisWeekDiv.appendChild(header1);
  payload.thisWeek.menu.forEach((day, index) => {
    const dayDiv = document.createElement('div');
    dayDiv.id = `day-0-${index}`;
    dayDiv.classList.add('day');
    dayDiv.innerHTML = dayjs(day.date).format('dddd');
    thisWeekDiv.appendChild(dayDiv);
    day.items.forEach((item, itemIdx) => {
      const lunchDiv = document.createElement('div');
      lunchDiv.id = `lunch-0-${index}-${itemIdx}`;
      lunchDiv.classList.add('item');
      lunchDiv.innerHTML = item;
      thisWeekDiv.appendChild(lunchDiv);
    });
  });

  let nextWeekDiv = document.getElementById('nextweek');
  const header2 = document.createElement('div');
  header2.id = `week-1`;
  header2.classList.add('header');
  header2.innerHTML = `Week of ${payload.nextWeek.weekOf}`;
  nextWeekDiv.appendChild(header2);

  payload.nextWeek.menu.forEach((day, index) => {
    const dayDiv = document.createElement('div');
    dayDiv.id = `day-1-${index}`;
    dayDiv.classList.add('day');
    dayDiv.innerHTML = dayjs(day.date).format('dddd');
    nextWeekDiv.appendChild(dayDiv);
    const lunchDiv = document.createElement('div');
    lunchDiv.id = `lunch-1-${index}`;
    lunchDiv.classList.add('item');
    lunchDiv.innerHTML = day.items.join(', ');
    nextWeekDiv.appendChild(lunchDiv);
  });
}

Module.register('MMM-SchoolMenu', {
  start: function () {
    Log.log('Starting module: ' + this.name);

    this.getMenus(this);
  },

  getMenus: function (_this) {
    // Make the initial request to the helper then set up the timer to perform the updates
    _this.sendSocketNotification('GET_WEEKLY_MENUS', {
      locationId: _this.config.locationId,
    });

    const now = dayjs();
    const nextDay = now.add(1, 'day').startOf('day');

    setTimeout(_this.getMenus, 60 * 60 * 1000, _this);
  },

  getScripts: function () {
    return ['dayjs.js'];
  },

  getStyles: function () {
    return ['MMM-SchoolMenu.css'];
  },

  getDom: function () {
    const wrapper = document.createElement('div');
    wrapper.id = 'school-menu-wrapper';
    wrapper.classList.add('MMM-SchoolMenu');
    wrapper.innerHTML =
      '<table><tr><td class="column"><div id="thisweek" class="week"/></td><td class="column"><div id="nextweek" class="week"/></td></tr>';

    return wrapper;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'GOT_WEEKLY_MENUS') {
      if (payload) {
        updateMenus(payload);
      }
    }
  },
});
