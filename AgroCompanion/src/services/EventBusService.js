import { Subject } from 'rxjs';

const subjects = {};

export const EventBusService = {
  publish: (event, data) => {
    if (!subjects[event]) {
      subjects[event] = new Subject();
    }
    subjects[event].next(data);
  },
  subscribe: (event, callback) => {
    if (!subjects[event]) {
      subjects[event] = new Subject();
    }
    return subjects[event].subscribe(callback);
  }
};