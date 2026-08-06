export interface DomainCommand<Type extends string = string, Payload = unknown> {
  readonly type: Type;
  readonly payload: Payload;
}
