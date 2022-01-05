# Nomad Token Bridge

### Message Format

Bridge messages follow the following format:

```
TokenID (36 bytes)
    -  4 bytes - domain specifier
    - 32 bytes - id (address) on that domain

Actions (variable)
    EITHER
    - Transfer (64 bytes)
        - 32 bytes - to. local recipient
        - 32 bytes - amount. number of tokens to send
    - Details
        - 32 bytes - name. new name of token
        - 32 bytes - symbol. new symbol for token
        -  1 byte  - decimals. new decimal place count

Message (100 or 101 bytes)
    - TokenID (36 bytes)
    - Action  (64 or 65 bytes)
```

Given a message we know the following:

- the `TokenID` is at indices 0-35
  - 0 - 3 Domain
  - 4 - 35 Id
- the `Action` is at indices 36 - end.
  - the action type can be determined from the message length alone.
  - for `Transfer` actions
    - 36 - 67 To
    - 68 - 99 Amount
  - for `Details` actions
    - 36 - 67 Name
    - 68 - 99 Symbol
    - 100 Decimals
