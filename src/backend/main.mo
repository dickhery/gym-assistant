import Map "mo:core/Map";
import Types "types";
import TrainingApi "mixins/TrainingApi";

actor {
  let accounts : Map.Map<Principal, Types.Account>;
  let totals : { var sessions : Nat };
  let durations : Map.Map<Principal, Types.Durations>;

  include TrainingApi(accounts, totals, durations);
}
