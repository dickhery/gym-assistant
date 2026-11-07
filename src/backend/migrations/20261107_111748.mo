import Map "mo:core/Map";

module {
  type OldActor = {};
  type NewActor = { durations : Map.Map<Principal, Map.Map<Text, Nat32>> };

  public func migration(_old : OldActor) : NewActor = {
    durations = Map.empty();
  };
}
