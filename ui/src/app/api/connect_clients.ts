import { InjectionToken, Provider } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Code, ConnectError, Interceptor, PromiseClient, Transport, createPromiseClient } from "@bufbuild/connect";
import { createConnectTransport } from "@bufbuild/connect-web";
import { AuthService, CalendarService, RoleService, SelfServiceService, UserService, RosterService, WorkShiftService } from "@tkd/apis";
import { CallService } from '@tkd/apis/gen/es/tkd/pbx3cx/v1/calllog_connect';
import { environment } from "src/environments/environment";

export const AUTH_SERVICE = new InjectionToken<AuthServiceClient>('AUTH_SERVICE');
export const SELF_SERVICE = new InjectionToken<SelfServiceClient>('SELF_SERVICE');
export const USER_SERVICE = new InjectionToken<UserServiceClient>('USER_SERVICE');
export const ROLE_SERVICE = new InjectionToken<RoleServiceClient>('ROLE_SERVICE');
export const CALENDAR_SERVICE = new InjectionToken<CalendarServiceClient>('CALENDAR_SERVICE');
export const ROSTER_SERVICE = new InjectionToken<RosterServiceClient>('ROSTER_SERVICE');
export const WORK_SHIFT_SERVICE = new InjectionToken<WorkShiftServiceClient>('WORK_SHIFT_SERVICE');
export const CALL_SERVICE = new InjectionToken<CallServiceClient>('OVERWRITE_SERVICE');

export type AuthServiceClient = PromiseClient<typeof AuthService>;
export type SelfServiceClient = PromiseClient<typeof SelfServiceService>;
export type UserServiceClient = PromiseClient<typeof UserService>;
export type RoleServiceClient = PromiseClient<typeof RoleService>;
export type CalendarServiceClient = PromiseClient<typeof CalendarService>;
export type RosterServiceClient = PromiseClient<typeof RosterService>;
export type CallServiceClient = PromiseClient<typeof CallService>;
export type WorkShiftServiceClient = PromiseClient<typeof WorkShiftService>;

function serviceClientFactory(type: any, ep: string): (route: ActivatedRoute, router: Router) => any {
  return ((route: ActivatedRoute, router: Router) => {
    let transport = transportFactory(route, router, ep);
    return createPromiseClient(type, transport);
  });
}

function makeProvider(token: InjectionToken<any>, type: any, ep: string): Provider {
  return {
    deps: [
      ActivatedRoute,
      Router,
    ],
    provide: token,
    useFactory: serviceClientFactory(type, ep),
  }
}

export const connectProviders: Provider[] = [
  makeProvider(AUTH_SERVICE, AuthService, environment.accountService) ,
  makeProvider(SELF_SERVICE, SelfServiceService, environment.accountService),
  makeProvider(USER_SERVICE, UserService, environment.accountService),
  makeProvider(ROLE_SERVICE, RoleService, environment.accountService),
  makeProvider(CALENDAR_SERVICE, CalendarService, environment.calendarService),
  makeProvider(ROSTER_SERVICE, RosterService, environment.rosterService),
  makeProvider(WORK_SHIFT_SERVICE, WorkShiftService, environment.rosterService),
  makeProvider(CALL_SERVICE, CallService, environment.callService)
]

const retryRefreshToken: (transport: Transport, activatedRoute: ActivatedRoute, router: Router) => Interceptor = (transport, activatedRoute, router) => {
  let pendingRefresh: Promise<void> | null = null;

  return (next) => async (req) => {
    try {
      const result = await next(req)
      return result;

    } catch (err) {
      const connectErr = ConnectError.from(err);

      // don't retry the request if it was a Login or RefreshToken.
      if (req.service.typeName === AuthService.typeName && (req.method.name === 'Login' || req.method.name == 'RefreshToken')) {
        console.log("skipping retry as requested service is " + `${req.service.typeName}/${req.method.name}`)

        throw err
      }

      if (connectErr.code === Code.Unauthenticated) {
        if (pendingRefresh === null) {
          let _resolve: any;
          let _reject: any;
          pendingRefresh = new Promise((resolve, reject) => {
            _resolve = resolve;
            _reject = reject;
          })

          pendingRefresh
            .catch(() => {})
            .then(() => pendingRefresh = null)

          const cli = createPromiseClient(AuthService, transport);

          console.log(`[DEBUG] call to ${req.service.typeName}/${req.method.name} not authenticated, trying to refresh token`)
          try {
            let redirect = activatedRoute.snapshot.queryParamMap.get("redirect");
            if (!redirect && router.getCurrentNavigation() !== null) {
              redirect = router.getCurrentNavigation()!.extractedUrl.queryParamMap.get("redirect")
            }

            const res = await cli.refreshToken({
              requestedRedirect: redirect || '',
            })

            _resolve();
          } catch (refreshErr) {
            console.error("failed to refresh token", refreshErr)

            _reject(err);

            throw err;
          }
        } else {
          // wait for the pending refresh to finish
          try {
            await pendingRefresh;
          } catch (_) {
            throw err;
          }
        }

        // retry with a new access token.
        return await next(req);
      }

      throw err;
    }
  }
}

export function transportFactory(route: ActivatedRoute, router: Router, endpoint: string): Transport {
  const retryTransport = createConnectTransport({baseUrl: environment.accountService, credentials: 'include'})

  return createConnectTransport({
    baseUrl: endpoint,
    credentials: 'include',
    jsonOptions: {
      ignoreUnknownFields: true
    },
    interceptors: [
      retryRefreshToken(retryTransport, route, router),
    ],
  })
}

