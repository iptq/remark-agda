```
module Simple where

open import Agda.Primitive
open import Relation.Binary.PropositionalEquality.Core

variable
    l : Level

data ℕ : Set where
    zero : ℕ
    suc : ℕ → ℕ

_+_ : ℕ → ℕ → ℕ
zero + b = b
suc a + b = suc (a + b)

+-comm : (m n : ℕ) → m + n ≡ n + m
+-comm zero n = lemma n where
    lemma : (n : ℕ) → n ≡ n + zero
    lemma zero = refl
    lemma (suc n) = cong suc (lemma n) 
+-comm (suc m) n = trans (cong suc (+-comm m n)) (sym (lemma n m)) where
    lemma : (m n : ℕ) → m + suc n ≡ suc (m + n)
    lemma zero n = refl 
    lemma (suc m) n = cong suc (lemma m n)
```