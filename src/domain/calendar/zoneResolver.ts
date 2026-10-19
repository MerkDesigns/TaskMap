import { localDateTimeOf, splitLocalDateTime, type LocalDateTime } from "./localDateTime";

/**
 * The only place local wall-clock times meet instants. Tests inject a resolver with daylight
 * saving transitions; production uses the system time zone.
 */
export interface ZoneResolver {
  /** The instant (epoch ms) a local time denotes. */
  toInstant(local: LocalDateTime): number;
  /** The local time (to the minute) at an instant. */
  toLocal(instant: number): LocalDateTime;
}

const two = (value: number) => String(value).padStart(2, "0");

/**
 * The PC's time zone, through `Date`: a time inside the spring-forward gap moves forward past it,
 * and a time in the repeated autumn hour resolves to its earlier occurrence.
 */
export const systemZoneResolver: ZoneResolver = {
  toInstant(local) {
    const { date, time } = splitLocalDateTime(local);
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes).getTime();
  },
  toLocal(instant) {
    const date = new Date(instant);
    return localDateTimeOf(
      `${String(date.getFullYear()).padStart(4, "0")}-${two(date.getMonth() + 1)}-${two(date.getDate())}`,
      `${two(date.getHours())}:${two(date.getMinutes())}`,
    );
  },
};
