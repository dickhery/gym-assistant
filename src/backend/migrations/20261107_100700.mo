import List "mo:core/List";
import Map "mo:core/Map";

module {
  type Category = { id : Text; name : Text };
  type Exercise = { id : Text; name : Text; categoryIds : [Text] };
  type LiftSet = { slot : Nat8; weight : Nat32; reps : Nat16; restSeconds : ?Nat16 };
  type Entry = {
    id : Text;
    exerciseId : Text;
    unit : { #lb; #kg };
    sets : [LiftSet];
    notes : Text;
  };
  type Session = { entry : Entry; loggedAt : Int };
  type Account = {
    categories : Map.Map<Text, Category>;
    exercises : Map.Map<Text, Exercise>;
    sessions : List.List<Session>;
    byExercise : Map.Map<Text, List.List<Session>>;
    byId : Map.Map<Text, Session>;
  };

  type NewActor = {
    accounts : Map.Map<Principal, Account>;
    totals : { var sessions : Nat };
  };

  public func migration(_old : {}) : NewActor = {
    accounts = Map.empty();
    totals = { var sessions = 0 };
  };
}
