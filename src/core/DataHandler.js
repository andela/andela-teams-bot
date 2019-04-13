import moment from 'moment';

export default class DataHandler {
  async dialogSuggestions(req, res, next) {
    try {
      let payload = req.payload;
      if (payload.type === 'dialog_suggestion') {
        if (payload.callback_id === 'pt_analytics_dialog') {
          const data = _getDates();
          res.status(200).json(data);
        }
        return;
      }
      next();
    } catch(error) {
      next(error);
    }
  }
}

function _getDates() {
  let dateMap = new Map();
  // let now = moment();
  for (let i = 0; i <= 90; i++) {
    let date = moment().subtract(i, 'days');
    let monthName = date.format('MMMM');
    if (dateMap.has(monthName)) {
      let dates = Array.from(dateMap.get(monthName));
      dates.push(date);
      dateMap.set(monthName, dates);
    } else {
      dateMap.set(monthName, [date]);
    }
  }
  let option_groups = [];
  for (let [monthName, dates] of dateMap) {
    let group = {};
    group.label = monthName;
    group.options = dates.map(d => {
      return {
        label: d.format('dddd, MMMM Do YYYY'),
        value: d.format('YYYY-MM-DD')
      }
    });
    option_groups.push(group);
  }
  return { option_groups };
}
