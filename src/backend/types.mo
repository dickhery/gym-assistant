import List "mo:core/List";
import Map "mo:core/Map";

module {
  public type Category = { id : Text; name : Text };
  public type Exercise = { id : Text; name : Text; categoryIds : [Text] };
  public type Unit = { #lb; #kg };
  public type LiftSet = { slot : Nat8; weight : Nat32; reps : Nat16; restSeconds : ?Nat16 };
  public type Entry = { id : Text; exerciseId : Text; unit : Unit; sets : [LiftSet]; notes : Text };
  public type SessionInput = Entry and { durationSeconds : ?Nat32 };
  public type StoredSession = { entry : Entry; loggedAt : Int };
  public type Session = StoredSession and { durationSeconds : ?Nat32 };
  public type Durations = Map.Map<Text, Nat32>;
  public type ExerciseSummary = { exercise : Exercise; latest : ?Session; sessionCount : Nat };
  public type Workspace = { categories : [Category]; exercises : [ExerciseSummary]; sessionCount : Nat };
  public type HistoryPage = { sessions : [Session]; before : ?Nat };

  public type Error = {
    #unauthorized;
    #invalidInput : Text;
    #notFound;
    #limitReached : Text;
    #conflict;
  };
  public type Result<T> = { #ok : T; #err : Error };

  public type Account = {
    categories : Map.Map<Text, Category>;
    exercises : Map.Map<Text, Exercise>;
    sessions : List.List<StoredSession>;
    byExercise : Map.Map<Text, List.List<StoredSession>>;
    byId : Map.Map<Text, StoredSession>;
  };
}
