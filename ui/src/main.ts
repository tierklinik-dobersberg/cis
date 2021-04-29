import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';


// capture log output in an array
(window as any).cnsl = {};
interface Log {
  params: any[];
  date: Date;
}
let logMessages: Log[] = [];

(window as any).getLogs = function (): Log[] {
  return logMessages;
};

const methodNames: (keyof Console)[] = ['log', 'warn', 'error'];
methodNames.forEach(methodName => {
  const originalMethod = console[methodName];
  (window as any).cnsl[methodName] = originalMethod;

  console[methodName] = function () {
    const params = Array.prototype.slice.call(arguments, 1);
    logMessages.push({
      params: params,
      date: new Date(),
    });

    if (logMessages.length > 1000) {
      logMessages = logMessages.slice(-1000)
    }
    originalMethod.apply(console, arguments);
  }
})

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
