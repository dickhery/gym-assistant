import Map "mo:core/Map";
import Types "types";
import TrainingApi "mixins/TrainingApi";

actor {
  let accounts : Map.Map<Principal, Types.Account>;
  let totals : { var sessions : Nat };

  include TrainingApi(accounts, totals);
}
